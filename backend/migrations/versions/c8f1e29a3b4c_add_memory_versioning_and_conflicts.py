"""add_memory_versioning_and_conflicts

Revision ID: c8f1e29a3b4c
Revises: d8303585fa01
Create Date: 2026-09-22 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f1e29a3b4c'
down_revision: Union[str, Sequence[str], None] = 'd8303585fa01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add versioning to memories & create memory_conflicts table."""
    # 1. Add versioning and tracking columns to memories table using batch_alter_table
    # (batch_alter_table ensures full compatibility with both SQLite and PostgreSQL)
    with op.batch_alter_table('memories', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('status', sa.String(length=32), nullable=False, server_default='active')
        )
        batch_op.add_column(
            sa.Column('confidence', sa.Float(), nullable=False, server_default='1.0')
        )
        batch_op.add_column(
            sa.Column('valid_from', sa.DateTime(), nullable=False, server_default=sa.func.now())
        )
        batch_op.add_column(
            sa.Column('valid_until', sa.DateTime(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('superseded_by_id', sa.String(), nullable=True)
        )
        batch_op.add_column(
            sa.Column('source_ref', sa.String(length=255), nullable=True)
        )
        batch_op.create_index(op.f('ix_memories_status'), ['status'], unique=False)
        batch_op.create_index(op.f('ix_memories_source_ref'), ['source_ref'], unique=False)
        batch_op.create_foreign_key(
            'fk_memories_superseded_by',
            'memories',
            ['superseded_by_id'],
            ['id'],
            ondelete='SET NULL'
        )

    # 2. Create memory_conflicts table for flagging contradictory or low-confidence facts
    op.create_table(
        'memory_conflicts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('existing_memory_id', sa.String(), sa.ForeignKey('memories.id', ondelete='CASCADE'), nullable=False),
        sa.Column('incoming_memory_text', sa.Text(), nullable=False),
        sa.Column('incoming_memory_type', sa.String(length=64), nullable=False),
        sa.Column('conflict_type', sa.String(length=64), nullable=False),  # 'contradiction' or 'temporal_update_low_confidence'
        sa.Column('confidence', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('resolution_status', sa.String(length=32), nullable=False, server_default='pending_review'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_memory_conflicts_user_id'), 'memory_conflicts', ['user_id'], unique=False)
    op.create_index(op.f('ix_memory_conflicts_existing_memory_id'), 'memory_conflicts', ['existing_memory_id'], unique=False)
    op.create_index(op.f('ix_memory_conflicts_resolution_status'), 'memory_conflicts', ['resolution_status'], unique=False)


def downgrade() -> None:
    """Downgrade schema: Drop memory_conflicts table & remove versioning columns."""
    # 1. Drop memory_conflicts table
    op.drop_index(op.f('ix_memory_conflicts_resolution_status'), table_name='memory_conflicts')
    op.drop_index(op.f('ix_memory_conflicts_existing_memory_id'), table_name='memory_conflicts')
    op.drop_index(op.f('ix_memory_conflicts_user_id'), table_name='memory_conflicts')
    op.drop_table('memory_conflicts')

    # 2. Revert memories table modifications
    with op.batch_alter_table('memories', schema=None) as batch_op:
        batch_op.drop_constraint('fk_memories_superseded_by', type_='foreignkey')
        batch_op.drop_index(op.f('ix_memories_source_ref'))
        batch_op.drop_index(op.f('ix_memories_status'))
        batch_op.drop_column('source_ref')
        batch_op.drop_column('superseded_by_id')
        batch_op.drop_column('valid_until')
        batch_op.drop_column('valid_from')
        batch_op.drop_column('confidence')
        batch_op.drop_column('status')
