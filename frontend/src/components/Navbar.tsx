import React from 'react';
import LoginButton from './LoginButton';

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: 'var(--card-surface)',
      borderBottom: '1px solid rgba(0, 0, 0, 0.05)'
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>📦</span>
        <span style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 800,
          fontSize: '18px',
          color: 'var(--text-main)'
        }}>
          Vintage Solo
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Status Pill */}
        <div className="status-pill online">
          <span style={{ 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            background: '#059669',
            display: 'inline-block'
          }} />
          READY
        </div>

        {/* Login/User Button */}
        <LoginButton compact />

        {/* Menu Button */}
        <button
          onClick={onMenuClick}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            fontSize: '20px',
            color: 'var(--text-secondary)'
          }}
          aria-label="Menu"
        >
          ☰
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

