"""Tablero: métricas agregadas para el tenant."""
from __future__ import annotations

import uuid
from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    work_orders_open: int = 0
    work_orders_in_progress: int = 0
    work_orders_ready: int = 0
    quotes_pending: int = 0
    clients_total: int = 0
    vehicles_total: int = 0
    appointments_today: int = 0
    appointments_scheduled: int = 0
    revenue_today: Decimal = Decimal("0")
    revenue_month: Decimal = Decimal("0")
    parts_low_stock: int = 0
    parts_total: int = 0
    technicians_active: int = 0


class DashboardStatusCount(BaseModel):
    status: str
    count: int


class RevenuePoint(BaseModel):
    date: str
    amount: Decimal


class TopPart(BaseModel):
    part_id: uuid.UUID
    name: str
    total: Decimal