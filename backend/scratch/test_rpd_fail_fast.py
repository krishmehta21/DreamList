import sys
import os
import time
import unittest
from unittest.mock import MagicMock, patch

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

sys.path.append(r"c:\Users\21meh\OneDrive\Desktop\DreamList\backend")

# Set dummy key so service initializes
os.environ["GEMINI_API_KEY"] = "dummy_key"

from app.services.research_service import run_research
from google.genai import errors

class TestRPDFailFast(unittest.TestCase):
    @patch("google.genai.Client")
    def test_rpd_error_fails_fast(self, MockClient):
        # Create mocked JSON response matching the actual API output for RPD
        response_json = {
            "error": {
                "code": 429,
                "message": "Resource has been exhausted (e.g. queries per day limit reached).",
                "status": "RESOURCE_EXHAUSTED",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [
                            {
                                "metricName": "generativelanguage.googleapis.com/generate_content_free_tier_requests_per_day",
                                "description": "Quota exceeded for Daily requests."
                            }
                        ]
                    }
                ]
            }
        }
        
        # Instantiate errors.APIError matching the SDK's internal constructor
        mock_err = errors.APIError(code=429, response_json=response_json)
        
        # Configure client mock to raise this error when interactions.create is called
        mock_client_instance = MockClient.return_value
        mock_client_instance.interactions.create.side_effect = mock_err
        
        start_time = time.time()
        with self.assertRaises(ValueError) as context:
            run_research("Test Item")
            
        duration = time.time() - start_time
        
        print(f"Caught expected exception: '{context.exception}' in {duration:.4f} seconds.")
        
        self.assertEqual(
            str(context.exception),
            "Daily research limit reached — try again after midnight Pacific time"
        )
        # Ensure it failed fast without waiting for multiple backoff attempts (should take < 1 second)
        self.assertLess(duration, 1.0, "Should fail fast immediately on RPD error without backing off")
        print("MOCK RPD FAIL FAST TEST PASSED successfully!")

if __name__ == "__main__":
    unittest.main()
