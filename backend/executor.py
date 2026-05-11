import asyncio
import aiohttp

PISTON_URL = "https://emkc.org/api/v2/piston/execute"
TIMEOUT_SECONDS = 10

async def stream_python(code: str):
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "language": "python",
                "version": "*",
                "files": [{"content": code}],
                "run_timeout": TIMEOUT_SECONDS * 1000,  # ms
            }

            async with session.post(PISTON_URL, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                result = await resp.json()

        run = result.get("run", {})
        stdout = run.get("stdout", "")
        stderr = run.get("stderr", "")
        code_exit = run.get("code", 0)
        signal = run.get("signal", None)

        # Stream stdout line by line
        if stdout:
            for line in stdout.splitlines():
                yield ("stdout", line)

        # Timeout detect
        if signal == "SIGKILL" or code_exit == 124:
            stderr = "⏱ Time limit exceeded (possible infinite loop)"
            code_exit = 124

        yield ("done", {
            "stderr": stderr,
            "code": code_exit
        })

    except asyncio.TimeoutError:
        yield ("done", {
            "stderr": "⏱ Time limit exceeded (possible infinite loop)",
            "code": 124
        })
    except Exception as e:
        yield ("done", {
            "stderr": str(e),
            "code": 1
        })