"""Router agregado de la API v1."""
from fastapi import APIRouter

from app.api.routes import (
    audit,
    auth,
    clients,
    dashboard,
    files,
    health,
    inventory,
    payments,
    platform,
    quotes,
    tenants,
    users,
    vehicles,
    workshop,
)

api_v1 = APIRouter(prefix="/api/v1")

api_v1.include_router(auth.router)
api_v1.include_router(health.router)
api_v1.include_router(platform.router)
api_v1.include_router(tenants.router)
api_v1.include_router(users.router)
api_v1.include_router(clients.router)
api_v1.include_router(vehicles.router)
api_v1.include_router(workshop.router)
api_v1.include_router(quotes.router)
api_v1.include_router(inventory.router)
api_v1.include_router(payments.router)
api_v1.include_router(files.router)
api_v1.include_router(dashboard.router)
api_v1.include_router(audit.router)

__all__ = ["api_v1"]