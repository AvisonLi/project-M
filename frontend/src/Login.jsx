import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoProviders, setSsoProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const SSO_BASE = '/api/sso/sso';

  const handleAuthSuccess = (payload) => {
    const token = payload?.token;
    const userPayload = payload?.student || payload?.user;
    if (!token || !userPayload) {
      throw new Error('Invalid authentication response');
    }

    const user = {
      ...userPayload,
      role: userPayload?.role || 'student',
    };

    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));

    setSuccess(payload?.message || 'Success!');

    if (user.role === 'student') {
      navigate('/student');
    } else if (user.role === 'faculty') {
      navigate('/faculty');
    } else if (user.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/student');
    }
  };

  const fetchSsoProviders = async () => {
    try {
      const res = await axios.get(`${SSO_BASE}/providers`);
      const providers = res.data?.providers || [];
      setSsoProviders(providers);
      if (providers.length > 0 && !selectedProvider) {
        setSelectedProvider(providers[0].name);
      }
    } catch (err) {
      setSsoProviders([]);
      setSelectedProvider('');
    }
  };

  useEffect(() => {
    if (isLogin) {
      fetchSsoProviders();
    }
  }, [isLogin]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let response;

      if (isLogin) {
        // Login
        if (!formData.email || !formData.password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }

        response = await axios.post('/api/auth/login', {
          email: formData.email,
          password: formData.password,
        });
      } else {
        // Register
        if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
          setError('All fields are required');
          setLoading(false);
          return;
        }

        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        response = await axios.post('/api/auth/register', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
        });
      }

      handleAuthSuccess(response.data);

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
    } catch (err) {
      const errorMessage =
        err.response?.status === 431
          ? 'Request header fields too large. Clear browser cookies and retry.'
          : err.response?.data?.error ||
            err.response?.statusText ||
            err.message ||
            'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = async () => {
    if (!selectedProvider) {
      setError('Please select an SSO provider');
      return;
    }

    setSsoLoading(true);
    setError('');
    setSuccess('');

    try {
      const loginRes = await axios.post(`${SSO_BASE}/login`, {
        provider: selectedProvider,
        returnUrl: `${window.location.origin}/`,
      });

      const ssoUrl = loginRes.data?.ssoUrl;
      const state = loginRes.data?.state;

      if (ssoUrl) {
        // Existing real SSO redirect flow
        window.location.href = ssoUrl;
        return;
      }

      // Mock fallback flow using existing callback endpoint
      const callbackRes = await axios.post(`${SSO_BASE}/callback`, {
        provider: selectedProvider,
        code: 'mock-code',
        state: state || 'mock-state',
      });
      handleAuthSuccess(callbackRes.data);
    } catch (err) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'SSO login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setSsoLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">{isLogin ? '📖 Login' : '✍️ Register'}</h1>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required={!isLogin}
              />
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        {isLogin && (
          <div className="sso-section">
            <div className="sso-divider"><span>or</span></div>
            <h3 className="sso-title">Single Sign-On</h3>
            {ssoProviders.length > 0 ? (
              <>
                <div className="form-group">
                  <label htmlFor="ssoProvider">SSO Provider</label>
                  <select
                    id="ssoProvider"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                  >
                    {ssoProviders.map((provider) => (
                      <option key={provider.id || provider.name} value={provider.name}>
                        {provider.name} ({provider.provider_type})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="sso-btn"
                  onClick={handleSsoLogin}
                  disabled={ssoLoading}
                >
                  {ssoLoading ? 'Connecting to SSO...' : 'Login with SSO'}
                </button>
              </>
            ) : (
              <p className="sso-empty">No active SSO providers found.</p>
            )}
          </div>
        )}

        <div className="toggle-mode">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button type="button" className="toggle-btn" onClick={toggleMode}>
            {isLogin ? 'Register here' : 'Login here'}
          </button>
        </div>

        <div className="demo-credentials">
          <p className="demo-title">Demo Credentials:</p>
          <p>Email: student@example.com</p>
          <p>Password: student123</p>
          <p>Email: faculty@example.com</p>
          <p>Password: faculty123</p>
          <p>Email: admin@example.com</p>
          <p>Password: admin123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
