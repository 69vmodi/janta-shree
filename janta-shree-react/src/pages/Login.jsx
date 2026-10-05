import { useState } from 'react';
import { supabase } from '../supabaseClient';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      if (data?.session && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleForgotPassword() {
    if (!email.trim()) {
      alert('Please enter your email address in the Email ID field first.');
      return;
    }
    supabase.auth.resetPasswordForEmail(email.trim()).then(({ error }) => {
      if (error) {
        alert('Error sending reset link: ' + error.message);
      } else {
        alert('Password reset link has been sent to your email.');
      }
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e293b 100%)',
        padding: '20px',
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          padding: '40px 10px'
        }}
      >
        {/* Top Horizontal Line */}
        <div
          style={{
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            marginBottom: '40px'
          }}
        />

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 300,
              letterSpacing: '5px',
              color: '#f8fafc',
              margin: '0 0 6px 0',
              textTransform: 'uppercase'
            }}
          >
            User Login
          </h1>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '3px',
              color: '#10b981',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}
          >
            Janta Shree Enterprise
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '12px',
              marginBottom: '20px',
              textAlign: 'center'
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {/* Email Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1.5px solid #334155',
              paddingBottom: '8px',
              marginBottom: '28px',
              transition: 'border-color 0.2s'
            }}
          >
            <span
              style={{
                fontSize: '17px',
                color: '#94a3b8',
                marginRight: '12px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              ✉
            </span>
            <input
              type="email"
              placeholder="Email ID"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '14.5px',
                letterSpacing: '0.5px'
              }}
            />
          </div>

          {/* Password Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1.5px solid #334155',
              paddingBottom: '8px',
              marginBottom: '22px'
            }}
          >
            <span
              style={{
                fontSize: '16px',
                color: '#94a3b8',
                marginRight: '12px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              🔒
            </span>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '14.5px',
                letterSpacing: '0.5px'
              }}
            />
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12.5px',
              color: '#94a3b8',
              marginBottom: '32px'
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  accentColor: '#10b981',
                  cursor: 'pointer'
                }}
              />
              Remember me
            </label>

            <span
              onClick={handleForgotPassword}
              style={{
                cursor: 'pointer',
                color: '#cbd5e1',
                fontStyle: 'italic',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => (e.target.style.color = '#10b981')}
              onMouseLeave={(e) => (e.target.style.color = '#cbd5e1')}
            >
              Forgot Password?
            </span>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: '1px solid #334155',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#1e293b';
                e.target.style.borderColor = '#10b981';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.backgroundColor = '#0f172a';
                e.target.style.borderColor = '#334155';
              }
            }}
          >
            {loading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>

        {/* Bottom Horizontal Line */}
        <div
          style={{
            width: '100%',
            height: '1px',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            marginTop: '40px'
          }}
        />
      </div>
    </div>
  );
}

export default Login;