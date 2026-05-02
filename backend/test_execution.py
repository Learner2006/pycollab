import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        
        # Test 1 — basic print
        r = await client.post("http://localhost:8000/execute", json={
            "code": "print('hello from chaos!')"
        })
        print("Test 1:", r.json())

        # Test 2 — math
        r = await client.post("http://localhost:8000/execute", json={
            "code": "x = [1,2,3,4,5]\nprint('sum:', sum(x))\nprint('squares:', [i**2 for i in x])"
        })
        print("Test 2:", r.json())

        # Test 3 — error handling
        r = await client.post("http://localhost:8000/execute", json={
            "code": "print(undefined_variable)"
        })
        print("Test 3 (should show stderr):", r.json())

        # Test 4 — timeout
        r = await client.post("http://localhost:8000/execute", json={
            "code": "while True: pass"
        })
        print("Test 4 (should timeout):", r.json())

asyncio.run(test())