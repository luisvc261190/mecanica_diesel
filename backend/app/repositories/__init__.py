"""Repositorios de acceso a datos. Una instancia por petición, creada con la sesión ``db``."""

from app.repositories.base import BaseRepository
from app.repositories.crm_repos import (
    ClientContactRepository,
    ClientRepository,
    VehicleHistoryRepository,
    VehicleRepository,
)
from app.repositories.finance_repos import (
    AuditRepository,
    ClaimRepository,
    PaymentRepository,
    WarrantyRepository,
)
from app.repositories.inventory_repos import InventoryRepository, MovementRepository, PartRepository
from app.repositories.platform_repos import (
    RefreshTokenRepository,
    TenantRepository,
    UserRepository,
)
from app.repositories.workshop_repos import (
    AppointmentRepository,
    ChecklistRepository,
    DiagnosticRepository,
    DocumentNumberRepository,
    QuoteRepository,
    ReceptionRepository,
    ServiceRepository,
    WorkOrderRepository,
)

__all__ = [
    "AppointmentRepository",
    "AuditRepository",
    "BaseRepository",
    "ChecklistRepository",
    "ClaimRepository",
    "ClientContactRepository",
    "ClientRepository",
    "DiagnosticRepository",
    "DocumentNumberRepository",
    "InventoryRepository",
    "MovementRepository",
    "PartRepository",
    "PaymentRepository",
    "QuoteRepository",
    "ReceptionRepository",
    "RefreshTokenRepository",
    "ServiceRepository",
    "TenantRepository",
    "UserRepository",
    "VehicleHistoryRepository",
    "VehicleRepository",
    "WarrantyRepository",
    "WorkOrderRepository",
]