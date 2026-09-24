"""Literales compartidos por los schemas: reflejan las CHECK constraints del modelo de datos."""
from __future__ import annotations

from typing import Literal

DocType = Literal["DNI", "CE", "RUC", "PASSPORT"]

PaymentMethodT = Literal["EFECTIVO", "TRANSFERENCIA", "TARJETA", "YAPE", "PLIN", "OTRO"]
PaymentStatusT = Literal["PENDING", "COMPLETED", "REVERSED", "FAILED"]

AppointmentStatusT = Literal["SCHEDULED", "CONFIRMED", "ARRIVED", "COMPLETED", "CANCELLED", "NO_SHOW"]
ReceptionStatusT = Literal["OPEN", "IN_DIAGNOSIS", "DIAGNOSED", "DONE", "CANCELLED"]
SeverityT = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
ResolutionStatusT = Literal["UNRESOLVED", "PARTIAL", "RESOLVED"]

WorkOrderStatusT = Literal[
    "RECEIVED",
    "DIAGNOSIS",
    "QUOTED",
    "WAITING_APPROVAL",
    "APPROVED",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "PAUSED",
    "QUALITY_CONTROL",
    "COMPLETED",
    "READY_FOR_PICKUP",
    "DELIVERED",
    "CANCELLED",
]
WorkOrderPriorityT = Literal["LOW", "NORMAL", "HIGH", "URGENT"]
QuoteStatusT = Literal["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"]
QuoteItemKindT = Literal["SERVICE", "PART"]
ChecklistKindT = Literal["RECEPTION", "DELIVERY"]

PartStatusT = Literal["ACTIVE", "INACTIVE"]
InventoryMovementTypeT = Literal[
    "PURCHASE", "SALE", "WORK_ORDER_USAGE", "RETURN", "ADJUSTMENT", "TRANSFER", "INITIAL_STOCK"
]

WarrantyStatusT = Literal["ACTIVE", "USED", "EXPIRED", "CANCELLED"]
ClaimStatusT = Literal["OPEN", "REJECTED", "APPROVED", "IN_REPAIR", "RESOLVED"]

TenantStatusT = Literal["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"]
SubscriptionStatusT = Literal["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"]
ClaimStatusLiteral = ClaimStatusT

FileKindT = Literal["RECEIPT", "INVOICE", "REPORT", "PHOTO", "OTHER"]
FileVisibilityT = Literal["PRIVATE", "PUBLIC"]