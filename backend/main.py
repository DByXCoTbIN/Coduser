from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import subprocess
import os
import json
import shutil
from pathlib import Path
from datetime import datetime

from config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# Pydantic models
class CommitRequest(BaseModel):
    message: str
    files: Optional[List[str]] = None

class QueryRequest(BaseModel):
    sql: str
    database: Optional[str] = None

class FileWriteRequest(BaseModel):
    path: str
    content: str

class RenameRequest(BaseModel):
    old_path: str
    new_path: str

class BranchRequest(BaseModel):
    name: str

class CheckoutRequest(BaseModel):
    branch: str

class ServerStatus(BaseModel):
    name: str
    status: str
    port: int
    pid: Optional[int] = None

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "timestamp": datetime.now().isoformat()
    }

# ==================== Git Operations ====================

@app.get("/git/status")
async def git_status():
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/git/log")
async def git_log():
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-20"],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/commit")
async def git_commit(request: CommitRequest):
    try:
        if request.files:
            for file in request.files:
                subprocess.run(
                    ["git", "add", file],
                    capture_output=True,
                    cwd=settings.WORKSPACE_ROOT
                )
        else:
            subprocess.run(
                ["git", "add", "."],
                capture_output=True,
                cwd=settings.WORKSPACE_ROOT
            )
        
        result = subprocess.run(
            ["git", "commit", "-m", request.message],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/push")
async def git_push():
    try:
        result = subprocess.run(
            ["git", "push"],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/pull")
async def git_pull():
    try:
        result = subprocess.run(
            ["git", "pull"],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/branch")
async def git_branch(request: BranchRequest):
    try:
        result = subprocess.run(
            ["git", "branch", request.name],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/checkout")
async def git_checkout(request: CheckoutRequest):
    try:
        result = subprocess.run(
            ["git", "checkout", request.branch],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/git/diff")
async def git_diff():
    try:
        result = subprocess.run(
            ["git", "diff"],
            capture_output=True,
            text=True,
            cwd=settings.WORKSPACE_ROOT
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/git/add")
async def git_add(files: List[str]):
    try:
        for file in files:
            subprocess.run(
                ["git", "add", file],
                capture_output=True,
                cwd=settings.WORKSPACE_ROOT
            )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Server Operations ====================

@app.get("/servers/status")
async def servers_status():
    servers = []
    
    # Check Apache
    try:
        result = subprocess.run(
            ["pgrep", "-x", "apache2"],
            capture_output=True
        )
        status = "running" if result.returncode == 0 else "stopped"
    except:
        status = "unknown"
    servers.append({"name": "apache", "status": status, "port": settings.APACHE_PORT})
    
    # Check MySQL
    try:
        result = subprocess.run(
            ["pgrep", "-x", "mysqld"],
            capture_output=True
        )
        status = "running" if result.returncode == 0 else "stopped"
    except:
        status = "unknown"
    servers.append({"name": "mysql", "status": status, "port": settings.MYSQL_PORT})
    
    return {"status": "success", "servers": servers}

@app.post("/servers/{server}/start")
async def start_server(server: str):
    try:
        if server == "apache":
            result = subprocess.run(
                ["sudo", "systemctl", "start", "apache2"],
                capture_output=True,
                text=True
            )
        elif server == "mysql":
            result = subprocess.run(
                ["sudo", "systemctl", "start", "mysql"],
                capture_output=True,
                text=True
            )
        else:
            raise HTTPException(status_code=400, detail="Unknown server")
        
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/servers/{server}/stop")
async def stop_server(server: str):
    try:
        if server == "apache":
            result = subprocess.run(
                ["sudo", "systemctl", "stop", "apache2"],
                capture_output=True,
                text=True
            )
        elif server == "mysql":
            result = subprocess.run(
                ["sudo", "systemctl", "stop", "mysql"],
                capture_output=True,
                text=True
            )
        else:
            raise HTTPException(status_code=400, detail="Unknown server")
        
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== File System Operations ====================

@app.get("/fs/list")
async def list_files(path: str = "."):
    try:
        items = []
        for item in os.listdir(path):
            full_path = os.path.join(path, item)
            items.append({
                "name": item,
                "path": full_path,
                "isDir": os.path.isdir(full_path),
                "size": os.path.getsize(full_path) if os.path.isfile(full_path) else 0,
                "modified": datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat()
            })
        return {"status": "success", "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fs/read")
async def read_file(path: str):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        return {"status": "success", "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/write")
async def write_file(request: FileWriteRequest):
    try:
        os.makedirs(os.path.dirname(request.path), exist_ok=True)
        with open(request.path, 'w', encoding='utf-8') as f:
            f.write(request.content)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/mkdir")
async def create_directory(path: str):
    try:
        os.makedirs(path, exist_ok=True)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/fs/delete")
async def delete_file(path: str):
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        else:
            os.remove(path)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/rename")
async def rename_file(request: RenameRequest):
    try:
        os.rename(request.old_path, request.new_path)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/fs/exists")
async def file_exists(path: str):
    return {"exists": os.path.exists(path)}

@app.get("/fs/stat")
async def file_stat(path: str):
    try:
        stat = os.stat(path)
        return {
            "status": "success",
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "isDir": os.path.isdir(path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fs/upload")
async def upload_file(file: UploadFile = File(...), path: str = "."):
    try:
        file_path = os.path.join(path, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"status": "success", "path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Database Operations ====================

@app.get("/db/list")
async def list_databases():
    try:
        result = subprocess.run(
            ["mysql", "-u", settings.MYSQL_USER, "-e", "SHOW DATABASES"],
            capture_output=True,
            text=True
        )
        databases = result.stdout.strip().split('\n')[1:]
        return {"status": "success", "databases": databases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/db/tables")
async def list_tables(database: str):
    try:
        result = subprocess.run(
            ["mysql", "-u", settings.MYSQL_USER, database, "-e", "SHOW TABLES"],
            capture_output=True,
            text=True
        )
        tables = result.stdout.strip().split('\n')[1:]
        return {"status": "success", "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/db/describe")
async def describe_table(database: str, table: str):
    try:
        result = subprocess.run(
            ["mysql", "-u", settings.MYSQL_USER, database, "-e", f"DESCRIBE {table}"],
            capture_output=True,
            text=True
        )
        return {"status": "success", "output": result.stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/db/query")
async def execute_query(request: QueryRequest):
    try:
        cmd = ["mysql", "-u", settings.MYSQL_USER]
        if request.database:
            cmd.append(request.database)
        cmd.extend(["-e", request.sql])
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        return {
            "status": "success" if result.returncode == 0 else "error",
            "output": result.stdout,
            "error": result.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )