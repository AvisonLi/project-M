#!/usr/bin/env python3
"""
Concurrent Load Testing Script for Student Management System
Tests the course registration API with concurrent requests
"""

import requests
import time
import threading
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

# Configurationa
BASE_URL = 'http://localhost:3000/api'
NUM_CONCURRENT_REQUESTS = 100
NUM_ITERATIONS = 5
LOGIN_EMAIL = 'student@example.com'
LOGIN_PASSWORD = 'password123'

# Global statistics
results = defaultdict(int)
response_times = []
results_lock = threading.Lock()


def login_user(email, password):
    """Authenticate user and return JWT token"""
    try:
        response = requests.post(
            f'{BASE_URL}/auth/login',
            json={'email': email, 'password': password},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()['token']
    except Exception as e:
        print(f'Login error: {e}')
    return None


def register_for_course(token, student_id, course_id, iteration):
    """Register a student for a course"""
    start_time = time.time()
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.post(
            f'{BASE_URL}/register',
            json={'courseId': course_id},
            headers=headers,
            timeout=10
        )

        elapsed = time.time() - start_time

        with results_lock:
            response_times.append(elapsed)

            if response.status_code == 201:
                results['success'] += 1
                return {
                    'status': 'success',
                    'time': elapsed,
                    'message': 'Course registration successful'
                }
            elif response.status_code == 429:
                results['rate_limited'] += 1
                return {
                    'status': 'rate_limited',
                    'time': elapsed,
                    'message': 'Too many concurrent requests'
                }
            elif response.status_code == 400:
                results['course_full'] += 1
                return {
                    'status': 'course_full',
                    'time': elapsed,
                    'message': response.json().get('error', 'Course full')
                }
            elif response.status_code == 409:
                results['already_enrolled'] += 1
                return {
                    'status': 'already_enrolled',
                    'time': elapsed,
                    'message': 'Already enrolled in this course'
                }
            else:
                results['error'] += 1
                return {
                    'status': 'error',
                    'time': elapsed,
                    'message': f'HTTP {response.status_code}: {response.text}'
                }

    except requests.Timeout:
        with results_lock:
            results['timeout'] += 1
        return {
            'status': 'timeout',
            'time': time.time() - start_time,
            'message': 'Request timeout'
        }
    except Exception as e:
        with results_lock:
            results['exception'] += 1
        return {
            'status': 'exception',
            'time': time.time() - start_time,
            'message': str(e)
        }


def run_load_test():
    """Run concurrent load test"""
    print('=' * 70)
    print('Student Management System - Load Testing')
    print('=' * 70)
    print(f'\nConfiguration:')
    print(f'  Base URL: {BASE_URL}')
    print(f'  Concurrent Requests: {NUM_CONCURRENT_REQUESTS}')
    print(f'  Iterations: {NUM_ITERATIONS}')
    print(f'  Total Requests: {NUM_CONCURRENT_REQUESTS * NUM_ITERATIONS}')

    # Login
    print(f'\n[1] Authenticating user...')
    token = login_user(LOGIN_EMAIL, LOGIN_PASSWORD)

    if not token:
        print('ERROR: Failed to authenticate. Exiting.')
        return

    print(f'✓ Authentication successful')
    print(f'  Token: {token[:20]}...')

    print(f'\n[2] Starting concurrent load test...')

    # Run iterations
    for iteration in range(NUM_ITERATIONS):
        print(f'\n  Iteration {iteration + 1}/{NUM_ITERATIONS}')
        print(f'  Sending {NUM_CONCURRENT_REQUESTS} concurrent requests...')

        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = []

            # Submit tasks
            for i in range(NUM_CONCURRENT_REQUESTS):
                # Vary course IDs (assuming courses 1-5 exist)
                course_id = (i % 5) + 1
                future = executor.submit(
                    register_for_course,
                    token,
                    i + 1000,  # Dummy student ID
                    course_id,
                    iteration
                )
                futures.append(future)

            # Wait for completion
            completed = 0
            for future in as_completed(futures):
                completed += 1
                if completed % 10 == 0:
                    print(f'    Progress: {completed}/{NUM_CONCURRENT_REQUESTS}')

        # Brief pause between iterations
        if iteration < NUM_ITERATIONS - 1:
            time.sleep(1)

    print(f'\n[3] Test completed!')

    # Print statistics
    print_statistics()


def print_statistics():
    """Print test results and statistics"""
    total = sum(results.values())
    success_rate = (results['success'] / total * 100) if total > 0 else 0

    print('\n' + '=' * 70)
    print('TEST RESULTS AND STATISTICS')
    print('=' * 70)

    print(f'\nRequest Summary:')
    print(f'  Total Requests:      {total}')
    print(f'  Successful:          {results["success"]} ({success_rate:.1f}%)')
    print(f'  Rate Limited:        {results["rate_limited"]}')
    print(f'  Course Full:         {results["course_full"]}')
    print(f'  Already Enrolled:    {results["already_enrolled"]}')
    print(f'  Errors:              {results["error"]}')
    print(f'  Timeouts:            {results["timeout"]}')
    print(f'  Exceptions:          {results["exception"]}')

    if response_times:
        response_times.sort()
        min_time = min(response_times)
        max_time = max(response_times)
        avg_time = sum(response_times) / len(response_times)
        median_time = response_times[len(response_times) // 2]
        p95_time = response_times[int(len(response_times) * 0.95)]
        p99_time = response_times[int(len(response_times) * 0.99)]

        print(f'\nResponse Time Statistics (seconds):')
        print(f'  Minimum:             {min_time:.4f}s')
        print(f'  Maximum:             {max_time:.4f}s')
        print(f'  Average:             {avg_time:.4f}s')
        print(f'  Median:              {median_time:.4f}s')
        print(f'  95th Percentile:     {p95_time:.4f}s')
        print(f'  99th Percentile:     {p99_time:.4f}s')

        total_time = sum(response_times)
        print(f'  Total Time:          {total_time:.2f}s')

    # Performance assessment
    print(f'\nPerformance Assessment:')
    if success_rate >= 95:
        print(f'  ✓ EXCELLENT - System handled high concurrency well')
    elif success_rate >= 80:
        print(f'  ⚠ GOOD - Acceptable performance with some limitations')
    elif success_rate >= 50:
        print(f'  ⚠ FAIR - Significant issues under load')
    else:
        print(f'  ✗ POOR - System cannot handle this load')

    print('\n' + '=' * 70)


if __name__ == '__main__':
    try:
        print('\nStarting load test in 3 seconds...\n')
        time.sleep(3)
        run_load_test()
    except KeyboardInterrupt:
        print('\n\nTest interrupted by user')
    except Exception as e:
        print(f'\nFatal error: {e}')
        import traceback
        traceback.print_exc()
