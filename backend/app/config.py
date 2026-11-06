"""
backend/app/config.py
Configuration — reads from environment / .env file
"""
from pydantic_settings import BaseSettings
from typing import Optional
class Settings(BaseSettings):
    # App
    app_name:    str = "Oracle EBS Intelligence Hub API"
    app_version: str = "6.0.0"
    debug:       bool = False
    # ICA Workflow (langflow)
    ica_workflow_url: str = ""
    ica_api_key:      str = ""
    ica_api_url:      str = ""
    ica_context_id:   str = ""
    # True: send the user's question unchanged to the ICA agent, which calls
    # the Context Broker tools itself. False: legacy mode (backend enriches the prompt).
    ica_agent_mode:   bool = True
    # MCP Gateway
    mcp_gateway_url:   str = ""
    mcp_gateway_id:    str = ""
    mcp_bearer_token:  str = ""
    mcp_api_key:       str = ""
    # BOB / Agent Studio
    bob_endpoint:       str = ""
    agent_register_id:  str = ""
    a2a_url:            str = ""
    # Langflow
    langflow_flow_id: str = ""
    langflow_app_id:  str = ""
    # Server
    allowed_origins:  str = "*"
    request_timeout:  int = 30
    max_retries:      int = 3
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"
    @property
    def allowed_origins_list(self) -> list:
        if self.allowed_origins == "*":
            return ["*"]
        return [
            o.strip()
            for o in self.allowed_origins.split(",")
            if o.strip()
        ]
    @property
    def ica_configured(self) -> bool:
        return bool(self.ica_workflow_url and self.ica_api_key)
    @property
    def mcp_configured(self) -> bool:
        return bool(self.mcp_gateway_url and self.mcp_api_key)
settings = Settings()
