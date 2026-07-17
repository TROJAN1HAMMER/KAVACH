import asyncio
from pathlib import Path
from app.orchestrator.scan_pipeline import execute_scan
import json

async def main():
    repo_path = Path("data/payloads/low_risk.zip")
    scan_id = "test_low"
    await execute_scan(scan_id, repo_path)
    
    with open("data/results/test_low.json", "r") as f:
        print(f.read())

if __name__ == "__main__":
    asyncio.run(main())
