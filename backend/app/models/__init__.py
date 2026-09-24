"""Registro central de modelos. Importar aquí todos los módulos garantiza que
``Base.metadata`` quede completo para Alembic autogenerate y para los tests.
"""

import app.models.aux_models as aux
import app.models.catalog as catalog
import app.models.crm as crm
import app.models.finance as finance
import app.models.inventory as inventory
import app.models.organization as organization
import app.models.platform as platform
import app.models.workshop as workshop
from app.models.aux_models import AuditLog, FileAsset, Notification
from app.models.base import Base
from app.models.catalog import (
    FaultCode,
    Fuel,
    PartCategory,
    Transmission,
    UnitOfMeasure,
    VehicleBrand,
    VehicleModel,
    VehicleType,
)
from app.models.crm import Client, ClientContact, Vehicle, VehicleClientHistory
from app.models.finance import Payment, Warranty, WarrantyClaim
from app.models.inventory import Inventory, InventoryMovement, Part
from app.models.organization import (
    Branch,
    DocumentSequence,
    Employee,
    TenantSetting,
)
from app.models.platform import (
    Permission,
    Plan,
    RefreshToken,
    Role,
    RolePermission,
    Tenant,
    TenantSubscription,
    User,
    UserTenantRole,
)
from app.models.workshop import (
    Appointment,
    Checklist,
    ChecklistItem,
    Diagnostic,
    DiagnosticFinding,
    DiagnosticFindingFaultCode,
    DiagnosticTest,
    LaborEntry,
    Quote,
    QuoteItem,
    Service,
    VehicleReception,
    WorkOrder,
    WorkOrderPart,
    WorkOrderService,
    WorkOrderStatusHistory,
    WorkOrderTechnician,
)

__all__ = [
    "Appointment",
    "AuditLog",
    "Base",
    "Branch",
    "Checklist",
    "ChecklistItem",
    "Client",
    "ClientContact",
    "Diagnostic",
    "DiagnosticFinding",
    "DiagnosticFindingFaultCode",
    "DiagnosticTest",
    "DocumentSequence",
    "Employee",
    "FaultCode",
    "FileAsset",
    "Fuel",
    "Inventory",
    "InventoryMovement",
    "LaborEntry",
    "Notification",
    "Part",
    "PartCategory",
    "Payment",
    "Permission",
    "Plan",
    "Quote",
    "QuoteItem",
    "RefreshToken",
    "Role",
    "RolePermission",
    "Service",
    "Tenant",
    "TenantSetting",
    "TenantSubscription",
    "Transmission",
    "UnitOfMeasure",
    "User",
    "UserTenantRole",
    "Vehicle",
    "VehicleBrand",
    "VehicleClientHistory",
    "VehicleModel",
    "VehicleReception",
    "VehicleType",
    "Warranty",
    "WarrantyClaim",
    "WorkOrder",
    "WorkOrderPart",
    "WorkOrderService",
    "WorkOrderStatusHistory",
    "WorkOrderTechnician",
    "aux_models",
    "catalog",
    "crm",
    "finance",
    "inventory",
    "organization",
    "platform",
    "workshop",
]