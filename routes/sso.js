const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { verifyToken } = require('../middleware/auth');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// SSO login initiation
router.post('/sso/login', async (req, res) => {
  const { provider, returnUrl } = req.body;

  if (!provider) {
    return res.status(400).json({ error: 'SSO provider is required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Get SSO provider configuration
    const ssoProvider = await client.query(
      'SELECT * FROM sso_providers WHERE name = $1 AND is_active = true',
      [provider]
    );

    if (ssoProvider.rows.length === 0) {
      return res.status(400).json({ error: 'SSO provider not found or not active' });
    }

    const providerConfig = ssoProvider.rows[0];

    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session/cache (simplified - in production use Redis/session store)
    // For now, we'll just return the SSO URL

    let ssoUrl = '';

    if (providerConfig.provider_type === 'university_sso') {
      // Construct university SSO URL
      const baseUrl = providerConfig.config?.base_url || '';
      const scopeValue = providerConfig.config?.scope || 'openid profile email';
      ssoUrl = `${baseUrl}/oauth/authorize?` +
        `client_id=${providerConfig.client_id}&` +
        `redirect_uri=${encodeURIComponent(providerConfig.redirect_uri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopeValue)}&` +
        `state=${state}`;
    } else if (providerConfig.provider_type === 'google') {
      ssoUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${providerConfig.client_id}&` +
        `redirect_uri=${encodeURIComponent(providerConfig.redirect_uri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `state=${state}`;
    } else if (providerConfig.provider_type === 'microsoft') {
      ssoUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${providerConfig.client_id}&` +
        `redirect_uri=${encodeURIComponent(providerConfig.redirect_uri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `state=${state}`;
    }

    res.json({
      ssoUrl,
      state,
      provider: providerConfig.name
    });
  } catch (err) {
    console.error('Error initiating SSO login:', err);
    res.status(500).json({ error: 'Server error initiating SSO login' });
  } finally {
    if (client) client.release();
  }
});

// SSO callback handler
router.post('/sso/callback', async (req, res) => {
  const { provider, code, state, error: oauthError } = req.body;

  if (oauthError) {
    return res.status(400).json({ error: `SSO authentication failed: ${oauthError}` });
  }

  if (!provider || !code) {
    return res.status(400).json({ error: 'Provider and authorization code are required' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Get SSO provider configuration
    const ssoProvider = await client.query(
      'SELECT * FROM sso_providers WHERE name = $1 AND is_active = true',
      [provider]
    );

    if (ssoProvider.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'SSO provider not found or not active' });
    }

    const providerConfig = ssoProvider.rows[0];

    // Exchange code for access token (simplified - in production use proper OAuth library)
    // This is a placeholder - actual implementation would make HTTP request to token endpoint
    const tokenResponse = {
      access_token: 'placeholder_token',
      id_token: 'placeholder_id_token'
    };

    // Decode ID token to get user info (simplified)
    const userInfo = {
      sub: 'sso_user_123',
      email: 'student@university.edu',
      name: 'John Doe',
      student_id: 'STU12345'
    };

    // Check if user exists via SSO mapping
    const existingMapping = await client.query(
      'SELECT local_user_id FROM sso_mappings WHERE sso_provider_id = $1 AND sso_user_id = $2',
      [providerConfig.id, userInfo.sub]
    );

    let userId;
    let user;

    if (existingMapping.rows.length > 0) {
      // Existing user - update mapping and get user info
      userId = existingMapping.rows[0].local_user_id;
      user = await client.query(
        'SELECT * FROM students WHERE id = $1',
        [userId]
      );

      // Update last sync
      await client.query(
        'UPDATE sso_mappings SET last_sync = CURRENT_TIMESTAMP WHERE sso_provider_id = $1 AND sso_user_id = $2',
        [providerConfig.id, userInfo.sub]
      );
    } else {
      // New user - create account
      const newUser = await client.query(
        `INSERT INTO students (name, email, student_id, role, is_active)
         VALUES ($1, $2, $3, 'student', true)
         RETURNING *`,
        [userInfo.name, userInfo.email, userInfo.student_id]
      );

      userId = newUser.rows[0].id;
      user = newUser;

      // Create SSO mapping
      await client.query(
        `INSERT INTO sso_mappings (local_user_id, sso_provider_id, sso_user_id, sso_email)
         VALUES ($1, $2, $3, $4)`,
        [userId, providerConfig.id, userInfo.sub, userInfo.email]
      );
    }

    // Update last login
    await client.query(
      'UPDATE students SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        id: userId,
        email: user.rows[0].email,
        role: user.rows[0].role,
        sso: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'SSO authentication successful',
      token,
      user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email,
        student_id: user.rows[0].student_id,
        role: user.rows[0].role
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error processing SSO callback:', err);
    res.status(500).json({ error: 'Server error processing SSO authentication' });
  } finally {
    if (client) client.release();
  }
});

// Get available SSO providers
router.get('/sso/providers', async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    const providers = await client.query(
      'SELECT id, name, provider_type FROM sso_providers WHERE is_active = true'
    );

    res.json({ providers: providers.rows });
  } catch (err) {
    console.error('Error fetching SSO providers:', err);
    res.status(500).json({ error: 'Server error fetching SSO providers' });
  } finally {
    if (client) client.release();
  }
});

// Admin: Configure SSO providers
router.post('/sso/providers', verifyToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only admins can configure SSO providers' });
  }

  const { name, providerType, clientId, clientSecret, redirectUri, config, isActive } = req.body;

  if (!name || !providerType) {
    return res.status(400).json({ error: 'Name and provider type are required' });
  }

  let client;
  try {
    client = await pool.connect();

    const result = await client.query(
      `INSERT INTO sso_providers (name, provider_type, client_id, client_secret, redirect_uri, config, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (name) DO UPDATE SET
         provider_type = EXCLUDED.provider_type,
         client_id = EXCLUDED.client_id,
         client_secret = EXCLUDED.client_secret,
         redirect_uri = EXCLUDED.redirect_uri,
         config = EXCLUDED.config,
         is_active = EXCLUDED.is_active
       RETURNING *`,
      [name, providerType, clientId, clientSecret, redirectUri, JSON.stringify(config || {}), isActive !== false]
    );

    res.json({
      message: 'SSO provider configured successfully',
      provider: result.rows[0]
    });
  } catch (err) {
    console.error('Error configuring SSO provider:', err);
    res.status(500).json({ error: 'Server error configuring SSO provider' });
  } finally {
    if (client) client.release();
  }
});

// Link existing account to SSO
router.post('/sso/link', verifyToken, async (req, res) => {
  const { provider, ssoUserId, ssoEmail } = req.body;

  if (!provider || !ssoUserId) {
    return res.status(400).json({ error: 'Provider and SSO user ID are required' });
  }

  let client;
  try {
    client = await pool.connect();

    // Get SSO provider
    const ssoProvider = await client.query(
      'SELECT id FROM sso_providers WHERE name = $1 AND is_active = true',
      [provider]
    );

    if (ssoProvider.rows.length === 0) {
      return res.status(400).json({ error: 'SSO provider not found or not active' });
    }

    // Check if mapping already exists
    const existingMapping = await client.query(
      'SELECT id FROM sso_mappings WHERE sso_provider_id = $1 AND sso_user_id = $2',
      [ssoProvider.rows[0].id, ssoUserId]
    );

    if (existingMapping.rows.length > 0) {
      return res.status(409).json({ error: 'SSO account already linked to another user' });
    }

    // Create mapping
    await client.query(
      `INSERT INTO sso_mappings (local_user_id, sso_provider_id, sso_user_id, sso_email)
       VALUES ($1, $2, $3, $4)`,
      [req.userId, ssoProvider.rows[0].id, ssoUserId, ssoEmail]
    );

    res.json({ message: 'SSO account linked successfully' });
  } catch (err) {
    console.error('Error linking SSO account:', err);
    res.status(500).json({ error: 'Server error linking SSO account' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;