import React from 'react';
import './Navbar.css';

function Navbar({ user, onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          📚 Student Management System
        </div>

        <ul className="navbar-menu">
          <li>
            <a href="/dashboard">Dashboard</a>
          </li>
          <li>
            <a href="/courses">Courses</a>
          </li>
          <li>
            <a href="/grades">Grades</a>
          </li>
          <li>
            <a href="/profile">Profile</a>
          </li>
          {user && user.role === 'admin' && (
            <li>
              <a href="/admin">Admin Panel</a>
            </li>
          )}
        </ul>

        <div className="navbar-user">
          {user ? (
            <>
              <span className="user-name">👤 {user.name}</span>
              <button className="logout-btn" onClick={onLogout}>
                Logout
              </button>
            </>
          ) : (
            <a href="/login" className="login-link">
              Login
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
