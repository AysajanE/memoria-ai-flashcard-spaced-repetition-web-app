import asyncio
import aiohttp
import time
import argparse
import statistics
import json
from typing import List, Dict, Optional
from dataclasses import dataclass
from datetime import datetime
import uuid


@dataclass
class LoadTestConfig:
    """Configuration for load testing."""
    base_url: str = "http://localhost:8000"
    internal_api_key: Optional[str] = None
    concurrent_requests: int = 10
    duration_seconds: int = 30
    endpoint: str = "/api/v1/generate-cards"
    request_delay: float = 0.1  # Delay between batches of requests


@dataclass
class RequestResult:
    """Result of a single request."""
    status_code: int
    response_time: float
    success: bool
    error: Optional[str] = None


@dataclass 
class LoadTestResults:
    """Results of a load test run."""
    config: LoadTestConfig
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    response_times: List[float] = None
    errors: List[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    
    def __post_init__(self):
        if self.response_times is None:
            self.response_times = []
        if self.errors is None:
            self.errors = []
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_requests == 0:
            return 0.0
        return (self.successful_requests / self.total_requests) * 100
    
    @property
    def requests_per_second(self) -> float:
        """Calculate requests per second."""
        if not self.start_time or not self.end_time:
            return 0.0
        duration = (self.end_time - self.start_time).total_seconds()
        if duration == 0:
            return 0.0
        return self.total_requests / duration
    
    @property
    def avg_response_time(self) -> float:
        """Calculate average response time."""
        return statistics.mean(self.response_times) if self.response_times else 0.0
    
    @property
    def median_response_time(self) -> float:
        """Calculate median response time."""
        return statistics.median(self.response_times) if self.response_times else 0.0
    
    @property
    def p95_response_time(self) -> float:
        """Calculate 95th percentile response time."""
        if not self.response_times:
            return 0.0
        sorted_times = sorted(self.response_times)
        index = int(0.95 * len(sorted_times))
        return sorted_times[index] if index < len(sorted_times) else sorted_times[-1]
    
    @property
    def p99_response_time(self) -> float:
        """Calculate 99th percentile response time."""
        if not self.response_times:
            return 0.0
        sorted_times = sorted(self.response_times)
        index = int(0.99 * len(sorted_times))
        return sorted_times[index] if index < len(sorted_times) else sorted_times[-1]


class LoadTester:
    """Load testing utility for the AI service."""
    
    def __init__(self, config: LoadTestConfig):
        self.config = config
        self.results = LoadTestResults(config=config)
        self.session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        timeout = aiohttp.ClientTimeout(total=60)  # 60 second timeout
        connector = aiohttp.TCPConnector(limit=100, limit_per_host=50)
        self.session = aiohttp.ClientSession(timeout=timeout, connector=connector)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for requests."""
        headers = {"Content-Type": "application/json"}
        if self.config.internal_api_key:
            headers["X-Internal-API-Key"] = self.config.internal_api_key
        return headers
    
    def _get_test_payload(self) -> Dict:
        """Generate test payload for requests."""
        job_id = f"load-test-{uuid.uuid4().hex[:8]}"
        
        if self.config.endpoint == "/api/v1/generate-cards":
            return {
                "jobId": job_id,
                "text": "Python is a high-level, interpreted programming language with dynamic semantics.",
                "model": "gpt-3.5-turbo",
                "cardType": "qa",
                "numCards": 3
            }
        elif self.config.endpoint == "/api/v1/preview/cards":
            return {
                "text": "Python is a programming language used for web development.",
                "model": "gpt-3.5-turbo", 
                "cardType": "qa",
                "numCards": 3
            }
        elif self.config.endpoint == "/api/v1/preview/tokenize":
            return {
                "text": "Python is a high-level programming language with many features and capabilities.",
                "max_chunk_tokens": 2000
            }
        else:
            return {}
    
    async def _make_request(self) -> RequestResult:
        """Make a single request and return the result."""
        start_time = time.time()
        
        try:
            url = f"{self.config.base_url}{self.config.endpoint}"
            headers = self._get_headers()
            payload = self._get_test_payload()
            
            async with self.session.post(url, json=payload, headers=headers) as response:
                response_time = time.time() - start_time
                await response.text()  # Consume response body
                
                return RequestResult(
                    status_code=response.status,
                    response_time=response_time,
                    success=200 <= response.status < 300
                )
                
        except Exception as e:
            response_time = time.time() - start_time
            return RequestResult(
                status_code=0,
                response_time=response_time,
                success=False,
                error=str(e)
            )
    
    async def _run_request_batch(self) -> List[RequestResult]:
        """Run a batch of concurrent requests."""
        tasks = [self._make_request() for _ in range(self.config.concurrent_requests)]
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    async def run_load_test(self) -> LoadTestResults:
        """Run the load test."""
        print(f"Starting load test...")
        print(f"Target: {self.config.base_url}{self.config.endpoint}")
        print(f"Concurrent requests: {self.config.concurrent_requests}")
        print(f"Duration: {self.config.duration_seconds}s")
        print(f"Request delay: {self.config.request_delay}s")
        print("-" * 50)
        
        self.results.start_time = datetime.utcnow()
        start_time = time.time()
        
        while time.time() - start_time < self.config.duration_seconds:
            batch_results = await self._run_request_batch()
            
            # Process results
            for result in batch_results:
                if isinstance(result, RequestResult):
                    self.results.total_requests += 1
                    self.results.response_times.append(result.response_time)
                    
                    if result.success:
                        self.results.successful_requests += 1
                    else:
                        self.results.failed_requests += 1
                        if result.error:
                            self.results.errors.append(result.error)
                        else:
                            self.results.errors.append(f"HTTP {result.status_code}")
                else:
                    # Handle exceptions from gather
                    self.results.total_requests += 1
                    self.results.failed_requests += 1
                    self.results.errors.append(str(result))
            
            # Brief pause between batches
            await asyncio.sleep(self.config.request_delay)
        
        self.results.end_time = datetime.utcnow()
        return self.results
    
    def print_results(self):
        """Print load test results in a formatted way."""
        results = self.results
        
        print("\n" + "=" * 60)
        print("LOAD TEST RESULTS")
        print("=" * 60)
        
        # Summary
        print(f"Total Requests:      {results.total_requests}")
        print(f"Successful:          {results.successful_requests}")
        print(f"Failed:              {results.failed_requests}")
        print(f"Success Rate:        {results.success_rate:.2f}%")
        print(f"Requests/Second:     {results.requests_per_second:.2f}")
        
        print("\nResponse Times:")
        print(f"Average:             {results.avg_response_time:.3f}s")
        print(f"Median:              {results.median_response_time:.3f}s")
        print(f"95th Percentile:     {results.p95_response_time:.3f}s")
        print(f"99th Percentile:     {results.p99_response_time:.3f}s")
        
        if results.response_times:
            print(f"Min:                 {min(results.response_times):.3f}s")
            print(f"Max:                 {max(results.response_times):.3f}s")
        
        # Error summary
        if results.errors:
            print(f"\nTop Errors:")
            error_counts = {}
            for error in results.errors:
                error_counts[error] = error_counts.get(error, 0) + 1
            
            for error, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
                print(f"  {error}: {count} times")
        
        print("=" * 60)
    
    def save_results_json(self, filename: str):
        """Save results to JSON file."""
        data = {
            "config": {
                "base_url": self.config.base_url,
                "endpoint": self.config.endpoint, 
                "concurrent_requests": self.config.concurrent_requests,
                "duration_seconds": self.config.duration_seconds,
                "request_delay": self.config.request_delay
            },
            "results": {
                "total_requests": self.results.total_requests,
                "successful_requests": self.results.successful_requests,
                "failed_requests": self.results.failed_requests,
                "success_rate": self.results.success_rate,
                "requests_per_second": self.results.requests_per_second,
                "response_times": {
                    "average": self.results.avg_response_time,
                    "median": self.results.median_response_time,
                    "p95": self.results.p95_response_time,
                    "p99": self.results.p99_response_time,
                    "min": min(self.results.response_times) if self.results.response_times else 0,
                    "max": max(self.results.response_times) if self.results.response_times else 0
                },
                "errors": list(set(self.results.errors)),  # Unique errors
                "start_time": self.results.start_time.isoformat() if self.results.start_time else None,
                "end_time": self.results.end_time.isoformat() if self.results.end_time else None
            }
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        print(f"\nResults saved to {filename}")


# Predefined test scenarios
SCENARIOS = {
    "smoke": LoadTestConfig(
        concurrent_requests=2,
        duration_seconds=10,
        request_delay=0.5
    ),
    "light": LoadTestConfig(
        concurrent_requests=5,
        duration_seconds=30,
        request_delay=0.2
    ),
    "moderate": LoadTestConfig(
        concurrent_requests=10, 
        duration_seconds=60,
        request_delay=0.1
    ),
    "heavy": LoadTestConfig(
        concurrent_requests=20,
        duration_seconds=120,
        request_delay=0.05
    ),
    "stress": LoadTestConfig(
        concurrent_requests=50,
        duration_seconds=180,
        request_delay=0.01
    )
}


async def run_scenario(scenario_name: str, base_url: str, internal_api_key: str = None, endpoint: str = "/api/v1/generate-cards"):
    """Run a predefined test scenario."""
    if scenario_name not in SCENARIOS:
        print(f"Unknown scenario: {scenario_name}")
        print(f"Available scenarios: {list(SCENARIOS.keys())}")
        return
    
    config = SCENARIOS[scenario_name]
    config.base_url = base_url
    config.internal_api_key = internal_api_key
    config.endpoint = endpoint
    
    async with LoadTester(config) as tester:
        await tester.run_load_test()
        tester.print_results()
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"load_test_results_{scenario_name}_{timestamp}.json"
        tester.save_results_json(filename)


async def main():
    """Main entry point for load testing."""
    parser = argparse.ArgumentParser(description="Load test the AI service")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the service")
    parser.add_argument("--api-key", help="Internal API key for admin endpoints")
    parser.add_argument("--scenario", default="light", choices=SCENARIOS.keys(), 
                       help="Test scenario to run")
    parser.add_argument("--endpoint", default="/api/v1/generate-cards",
                       help="Endpoint to test")
    parser.add_argument("--concurrent", type=int, help="Number of concurrent requests")
    parser.add_argument("--duration", type=int, help="Test duration in seconds")
    parser.add_argument("--delay", type=float, help="Delay between request batches")
    
    args = parser.parse_args()
    
    # Use scenario or custom parameters
    if args.concurrent or args.duration or args.delay:
        config = LoadTestConfig(
            base_url=args.url,
            internal_api_key=args.api_key,
            endpoint=args.endpoint,
            concurrent_requests=args.concurrent or 10,
            duration_seconds=args.duration or 30,
            request_delay=args.delay or 0.1
        )
        
        async with LoadTester(config) as tester:
            await tester.run_load_test()
            tester.print_results()
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"load_test_results_custom_{timestamp}.json"
            tester.save_results_json(filename)
    else:
        await run_scenario(args.scenario, args.url, args.api_key, args.endpoint)


if __name__ == "__main__":
    asyncio.run(main())