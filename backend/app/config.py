from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_server_url: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_fallback_model: str = "gemini-3.5-flash"
    whisper_model_size: str = "base"

    class Config:
        env_file = ".env"


settings = Settings()
