"""Blocks platform SDK for Python code actions.

Port of shared/blocks/blocks-client.ts with the same endpoints and payload shapes.
Deliberately stdlib-only (urllib) so an action with no dependencies ships a zip with
no pip tree at all.

    from blocks import BlocksClient

    def invoke(payload, context):
        client = BlocksClient(context)
        rows = client.query_table("Tasks", {"from": {"table": "Tasks"}})
        return {"count": len(rows["items"])}
"""

import http.client
import json
import os
import urllib.error
import urllib.parse
import urllib.request

from .mappings import BLOCKS_CLIENT_MAPPINGS

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)

DEFAULT_TIMEOUT_SECONDS = 120
ACTION_RESULT_MEDIA_TYPE = "application/vnd.blocks.action-result.v1+json"


class BlocksApiError(Exception):
    """A platform API call failed.

    `status` is the HTTP status for a non-2xx response, or None when the request never
    got one (DNS/connection/timeout). Every failure mode of every client method raises
    this one type, so `except BlocksApiError` is all an action ever needs.
    """

    def __init__(self, method, url, status, body):
        super().__init__(
            "Failed to {} call {}: {} {}".format(
                method, url, status if status is not None else "no response", body
            )
        )
        self.status = status
        self.body = body


class BlocksClient:
    def __init__(self, context, timeout=DEFAULT_TIMEOUT_SECONDS):
        self._base_path = os.environ.get("BLOCKS_BASE_PATH") or ""
        self._context = context or {}
        self._timeout = timeout

    # ── transport ──

    def _api_call(self, method, url, data=None, stream_action=False):
        final_url = "{}{}".format(self._base_path, url)
        body = json.dumps(data).encode("utf-8") if data is not None else None
        request = urllib.request.Request(final_url, data=body, method=method)
        request.add_header("Content-Type", "application/json")
        if stream_action:
            request.add_header("Accept", ACTION_RESULT_MEDIA_TYPE)
            request.add_header("Accept-Encoding", "identity")
        request.add_header("Authorization", "Bearer {}".format(self._token))
        request.add_header("x-app-id", str(self._context.get("appId") or ""))
        app_version = self._context.get("appVersion")
        if app_version is not None:
            request.add_header("x-app-version", str(app_version))
        request.add_header("user-agent", USER_AGENT)

        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                raw = response.read().decode("utf-8")
                status = response.status
                streamed = (
                    stream_action
                    and response.headers.get_content_type() == ACTION_RESULT_MEDIA_TYPE
                )
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace")
            raise BlocksApiError(method, url, error.code, raw) from error
        except (
            urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException
        ) as error:
            # A request that never got a response (DNS, refused connection, timeout) is
            # still "the platform call failed" — raise the same type so an action does not
            # have to catch urllib's exception tree to handle it.
            raise BlocksApiError(method, url, None, str(error)) from error

        if status >= 300:
            raise BlocksApiError(method, url, status, raw)
        if not raw and not streamed:
            return None
        try:
            result = json.loads(raw)
        except ValueError:
            if streamed:
                raise BlocksApiError(method, url, status, "Invalid action response")
            return raw
        if streamed:
            if not isinstance(result, dict) or not isinstance(result.get("ok"), bool):
                raise BlocksApiError(method, url, status, "Invalid action response")
            if not result["ok"]:
                error = result.get("error")
                if not isinstance(error, dict) or not isinstance(
                    error.get("message"), str
                ):
                    raise BlocksApiError(method, url, status, "Invalid action error response")
                raise BlocksApiError(method, url, error.get("statusCode"), error["message"])
            return result.get("output")
        return result

    @property
    def _token(self):
        return self._context.get("token") or ""

    # ── actions ──

    def invoke_action(self, action_name, input_data):
        action_id = BLOCKS_CLIENT_MAPPINGS.get(action_name)
        if not action_id:
            raise ValueError("action {} not found".format(action_name))
        # The ref must occupy exactly ONE path segment. Under the unified (v2) block model it
        # is a named ref ("productSlug/BlockName", plus "&"-joined segments for a table-ops
        # tool), and wf-service serves only single-segment ":workflowId" routes — a raw "/"
        # becomes a second segment and matches no route (404). Encoded, it round-trips: Express
        # decodes the param and blocks-store resolves the qualified ref. Byte-identical for a
        # plain block id, so apps on the older block model keep the exact URL they use today;
        # their "&"-joined composites become "%26", decoded back before the split on "&".
        return self._api_call(
            "POST",
            "/workflow/api/{}".format(urllib.parse.quote(action_id, safe="")),
            {
                "input": input_data,
                "context": {
                    "appId": self._context.get("appId"),
                    "mainWorkflowId": self._context.get("mainWorkflowId"),
                },
            },
            stream_action=True,
        )

    def generate_file_signed_url(self, file_url):
        return self.invoke_action("GenerateFileSignedUrl", {"fileUrl": file_url})

    def get_current_user(self):
        return {"user": self._api_call("GET", "/app-users/api/current")}

    # ── data ──

    def create_item(self, table_name, item):
        response = self._api_call(
            "POST", "/data/api/tables/{}/items".format(table_name), [item]
        )
        items = (response or {}).get("items") or []
        return {"item": items[0] if items else None}

    def create_items(self, table_name, items):
        return self._api_call(
            "POST", "/data/api/tables/{}/items".format(table_name), list(items)
        )

    def get_item(self, table_name, item_id):
        return self._api_call(
            "GET", "/data/api/tables/{}/items/{}".format(table_name, item_id)
        )

    def update_item(self, table_name, item_id, item):
        return self._api_call(
            "PUT", "/data/api/tables/{}/items/{}".format(table_name, item_id), item
        )

    def update_items(self, table_name, items):
        return self._api_call(
            "PUT",
            "/data/api/tables/{}/items".format(table_name),
            {"items": list(items)},
        )

    def delete_item(self, table_name, item_id):
        return self._api_call(
            "DELETE", "/data/api/tables/{}/items/{}".format(table_name, item_id)
        )

    def delete_items(self, table_name, body):
        return self._api_call(
            "POST", "/data/api/tables/{}/items/delete".format(table_name), body
        )

    def query_table(self, table_name, query):
        return self._api_call(
            "POST", "/data/api/tables/{}/query".format(table_name), query
        )
