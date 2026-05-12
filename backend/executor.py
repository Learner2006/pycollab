import aiohttp
import asyncio

PAIZA_URL = "https://api.paiza.io/runners/create"
DETAILS_URL = "https://api.paiza.io/runners/get_details"

async def stream_python(code: str):
    payload = {
        "source_code": code,
        "language": "python3",
        "longpoll": True,
        "api_key": "guest"
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(PAIZA_URL, json=payload) as resp:
                run_data = await resp.json()
                run_id = run_data.get("id")

            for _ in range(20):
                await asyncio.sleep(0.5)
                params = {"id": run_id, "api_key": "guest"}
                async with session.get(DETAILS_URL, params=params) as resp:
                    result = await resp.json()
                if result.get("status") == "completed":
                    break

            params = {"id": run_id, "api_key": "guest"}
            async with session.get(DETAILS_URL, params=params) as resp:
                result = await resp.json()

        stdout = result.get("stdout", "") or ""
        stderr = result.get("stderr", "") or ""
        build_stderr = result.get("build_stderr", "") or ""
        paiza_result = result.get("result", "")

        if stdout:
            for line in stdout.splitlines():
                yield ("stdout", line)

        # Timeout detect
        if paiza_result == "timeout":
            yield ("done", {
                "stderr": "⏱ Time limit exceeded (possible infinite loop)",
                "code": 124
            })
            return


        yield ("done", {
            "stderr": stderr or build_stderr,
            "code": (result.get("exit_code") or 0)
        })

    except asyncio.TimeoutError:
        yield ("done", {
            "stderr": "⏱ Time limit exceeded",
            "code": 124
        })
    except Exception as e:
        yield ("done", {"stderr": str(e), "code": 1})