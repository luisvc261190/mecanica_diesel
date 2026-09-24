"""Onboarding: alta de tenant + dueño + primera sucursal en una sola transacción."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_platform_context
from app.core.exceptions import ConflictError
from app.core.security import hash_password
from app.models.platform import Plan, Role, Tenant, TenantSubscription, User
from app.repositories.platform_repos import TenantRepository, UserRepository
from app.schemas.auth import OnboardingRequest, OnboardingResponse, TokenPair
from app.schemas.tenants import TenantRead
from app.services.auth import AuthService


class OnboardingService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tenants = TenantRepository(db)

    async def _plan_by_code(self, code: str) -> Plan | None:
        return (await self.db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()

    async def _role_by_code(self, code: str) -> Role | None:
        return (await self.db.execute(select(Role).where(Role.code == code))).scalar_one_or_none()

    async def create_company(
        self,
        *,
        company_name: str,
        slug: str,
        owner_email: str,
        owner_full_name: str,
        owner_phone: str | None,
        password: str,
        plan_code: str,
        currency: str,
        country: str,
    ) -> tuple[User, Tenant]:
        """Crea tenant + dueño (OWNER) + suscripción y provisiona la configuración base.

        Corre en contexto de plataforma y NO hace commit: el llamador decide cuándo
        persistir (lo usan el onboarding público y el panel del SUPER_ADMIN).
        """
        await set_platform_context(self.db)

        email = owner_email.strip().lower()
        slug = slug.strip().lower()

        if await self.users.by_email(email):
            raise ConflictError(message="El email ya está registrado", code="EMAIL_IN_USE")
        await self.tenants.require_unique_slug(slug)

        plan = await self._plan_by_code(plan_code)
        if plan is None:
            from app.core.exceptions import ValidationError

            raise ValidationError(message="Plan inválido", code="INVALID_PLAN")

        user = await self.users.create(
            email=email,
            password_hash=hash_password(password),
            full_name=owner_full_name,
            phone=owner_phone,
        )
        tenant = await self.tenants.add(
            Tenant(
                commercial_name=company_name,
                slug=slug,
                status="ACTIVE",
                currency=currency,
                country=country,
            )
        )

        owner_role = await self._role_by_code("OWNER")
        if owner_role is not None:
            await self.users.assign_role(user.id, tenant.id, owner_role)

        self.db.add(
            TenantSubscription(
                tenant_id=tenant.id,
                plan_id=plan.id,
                status="TRIAL",
                trial_ends_at=datetime.now(UTC) + timedelta(days=14),
            )
        )

        await self.db.execute(text("SELECT provision_tenant(:tid)"), {"tid": tenant.id})
        await self.db.flush()
        return user, tenant

    async def onboard(self, payload: OnboardingRequest, user_agent: str | None = None) -> OnboardingResponse:
        """Registro público: crea tenant + dueño en una transacción y devuelve sesión."""
        user, tenant = await self.create_company(
            company_name=payload.company_name,
            slug=payload.slug,
            owner_email=payload.owner_email,
            owner_full_name=payload.owner_full_name,
            owner_phone=payload.owner_phone,
            password=payload.password,
            plan_code=payload.plan_code,
            currency=payload.currency,
            country=payload.country,
        )

        token = await self._provision_initial_tokens(user, tenant.id, user_agent)

        await self.db.commit()
        return OnboardingResponse(
            tenant=TenantRead.model_validate(tenant),
            token=token,
        )

    async def _provision_initial_tokens(self, user: User, tenant_id: uuid.UUID, user_agent: str | None) -> TokenPair:
        return await AuthService(self.db)._issue_tokens(user, tenant_id, user_agent)