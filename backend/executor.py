import asyncio
import tempfile
import os
import docker

client = docker.from_env()

async def execute_python(code: str) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode='w') as f:
        f.write(code)
        tmp_path = f.name
        tmp_name = os.path.basename(tmp_path)

    try:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, _run_in_docker, tmp_path, tmp_name)
        return result
    finally:
        os.unlink(tmp_path)


def _run_in_docker(tmp_path: str, tmp_name: str) -> dict:
    container = None

    try:
        container = client.containers.run(
            image="python:3.11-slim",
            command=["python", f"/code/{tmp_name}"],
            volumes={tmp_path: {"bind": f"/code/{tmp_name}", "mode": "ro"}},
            mem_limit="128m",
            network_disabled=True,
            cpu_period=100000,
            cpu_quota=50000,
            read_only=True,
            tmpfs={"/tmp": ""},
            user="nobody",
            detach=True,
        )

        try:
            # ⏱ wait max 10 sec (short rakha for stability)
            result = container.wait(timeout=10)

            stdout = container.logs(stdout=True, stderr=False).decode()
            stderr = container.logs(stdout=False, stderr=True).decode()

            return {
                "stdout": stdout,
                "stderr": stderr,
                "code": result.get("StatusCode", 0)
            }

        except Exception:
            # 🔥 timeout (infinite loop)
            try:
                container.kill()
            except:
                pass

            return {
                "stdout": "",
                "stderr": "⏱ Time limit exceeded (possible infinite loop)",
                "code": 1
            }

    except Exception as e:
        return {
            "stdout": "",
            "stderr": str(e),
            "code": 1
        }

    finally:
        if container:
            try:
                container.remove(force=True)
            except:
                pass