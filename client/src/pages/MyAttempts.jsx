// Page showing the user's previous quiz attempts.
import { useState, useEffect } from 'react';
import { apiClient } from '../context/AuthContext'; // Use apiClient
import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns'; // Use relative dates
import { ListChecks, AlertCircle, Loader2, CheckCircle, XCircle, Percent, HelpCircle } from 'lucide-react'; // Keep icons

function MyAttempts() {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // No need for token/isLoggedIn here, apiClient handles auth check via interceptor

  useEffect(() => {
    const fetchAttempts = async () => {
      setLoading(true);
      setError(null);
      console.log("MyAttempts: Attempting to fetch data...");
      try {
        // Use apiClient - token is added automatically
        const response = await apiClient.get('/quiz-attempts/my-attempts');
        setAttempts(response.data || []);
        console.log("MyAttempts: Data fetched successfully:", response.data);
      } catch (err) {
        console.error('MyAttempts: Error fetching attempts:', err);
        // AuthContext interceptor should handle 401, show other errors
        if (err.response?.status !== 401) {
             const errorMessage = err.response?.data?.message || err.message || 'Failed to load attempts.';
             setError(`Could not load data: ${errorMessage}`);
        } else {
             // If 401, AuthContext handles logout, maybe set a generic error or rely on redirect
             setError("Authentication failed. Please log in again.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAttempts();
  }, []); // Fetch only once on mount

  // Helper function to calculate percentage (from previous working version)
  // Assumes 'score' parameter is the raw correct count
  const calculatePercentage = (score, total) => {
    if (total === 0 || score === undefined || total === undefined) return 0;
    // Ensure score is treated as a number
    const numericScore = Number(score);
    const numericTotal = Number(total);
    if (isNaN(numericScore) || isNaN(numericTotal) || numericTotal === 0) return 0;
    return Math.round((numericScore / numericTotal) * 100);
  };

  // --- Loading State ---
  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <PageHeader title="My Attempts" />
        <div className="flex justify-center items-center py-10 text-gray-500">
          <Loader2 className="animate-spin mr-2 h-5 w-5" />
          <span>Loading attempts...</span>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="p-6 md:p-8">
        <PageHeader title="My Attempts" />
        <div className="mt-8 flex items-center justify-center text-red-600 bg-red-100 p-4 rounded border border-red-300">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  // --- Main Content ---
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="My Attempts" />

      {attempts.length === 0 ? (
        // --- No Attempts Message ---
        <div className="text-center text-gray-600 mt-12 bg-white p-8 rounded-lg shadow border border-gray-200">
          <ListChecks size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Attempts Yet</h3>
          <p className="text-sm mb-6">You haven't attempted any quizzes. Why not try one now?</p>
          <Link
            to="/study" // Link to Study page
            className="inline-flex items-center px-6 py-2 bg-[#2980b9] text-white rounded-md shadow-sm hover:bg-[#2573a6] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6]"
          >
            Start Studying
          </Link>
        </div>
      ) : (
        // --- List of Attempts (Using previous working display logic) ---
        <div className="mt-6 space-y-4">
          {attempts.map((attempt) => {
            // Calculate percentage assuming attempt.score is the COUNT
            const percentage = calculatePercentage(attempt.score, attempt.totalQuestions);
            const scoreColor = percentage >= 70 ? 'text-green-600' : percentage >= 40 ? 'text-yellow-600' : 'text-red-600'; // Color based on calculated percentage

            return (
              <div
                key={attempt._id}
                className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    {/* Left Side: Title and Date */}
                    <div>
                      <h3 className="text-lg font-semibold text-[#2980b9] truncate" title={attempt.quizTitle}>
                        {attempt.quizTitle || 'Quiz Title Missing'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {/* Use formatDistanceToNow for relative dates */}
                        Completed: {formatDistanceToNow(new Date(attempt.completedAt), { addSuffix: true })}
                      </p>
                    </div>
                    {/* Right Side: Score (Count / Total and Percentage) */}
                    <div className="text-right flex-shrink-0 mt-2 sm:mt-0">
                      <p className="text-xl font-bold text-gray-700">
                        {/* Display score as COUNT / TOTAL */}
                        {attempt.score} / {attempt.totalQuestions}
                      </p>
                      <p className={`text-sm font-medium ${scoreColor}`}>
                        {/* Display calculated percentage */}
                        ({percentage}%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyAttempts;
