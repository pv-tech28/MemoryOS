"""add_auth_id_and_update_user_table

Revision ID: d8303585fa01
Revises: e4347e76b746
Create Date: 2026-07-19 19:05:30.034280

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8303585fa01'
down_revision: Union[str, Sequence[str], None] = 'e4347e76b746'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns
    op.add_column('users', sa.Column('auth_id', sa.String(), nullable=True))  # nullable first, then we'll make it not null later if possible
    op.add_column('users', sa.Column('full_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(), nullable=True))
    op.add_column('users', sa.Column('plan', sa.String(), nullable=False, server_default='free'))
    op.add_column('users', sa.Column('memory_health', sa.Float(), nullable=False, server_default='100.0'))
    op.add_column('users', sa.Column('last_login', sa.DateTime(), nullable=True))
    
    # Create indexes
    op.create_index(op.f('ix_users_auth_id'), 'users', ['auth_id'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    
    # Drop old columns we don't need
    op.drop_column('users', 'display_name')
    op.drop_column('users', 'profile_picture_url')
    op.drop_column('users', 'bio')
    op.drop_column('users', 'email_verified')
    op.drop_column('users', 'password_hash')


def downgrade() -> None:
    """Downgrade schema."""
    # Add back old columns
    op.add_column('users', sa.Column('password_hash', sa.VARCHAR(), nullable=True))
    op.add_column('users', sa.Column('email_verified', sa.BOOLEAN(), nullable=True))
    op.add_column('users', sa.Column('bio', sa.TEXT(), nullable=True))
    op.add_column('users', sa.Column('profile_picture_url', sa.VARCHAR(), nullable=True))
    op.add_column('users', sa.Column('display_name', sa.VARCHAR(), nullable=True))
    
    # Drop indexes
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_auth_id'), table_name='users')
    
    # Drop new columns
    op.drop_column('users', 'last_login')
    op.drop_column('users', 'memory_health')
    op.drop_column('users', 'plan')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'full_name')
    op.drop_column('users', 'auth_id')
