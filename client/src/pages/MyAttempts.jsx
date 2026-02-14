// Page showing the user's previous quiz attempts.
import { useState, useEffect } from 'react';
import { apiClient } from '../context/AuthContext'; // Use apiClient
import PageHeader from '../components/PageHeader';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns'; // Use relative dates
import { ListChecks, AlertCircle, Loader2 } from 'lucide-react';
import { Badge, Button, Card } from '../components/ui';

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
      <div>
        <PageHeader title="My Attempts" subtitle="Track quiz history and score trends over time." />
        <div className="flex justify-center items-center py-10 text-[var(--muted)]">
          <Loader2 className="animate-spin mr-2 h-5 w-5" />
          <span>Loading attempts...</span>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div>
        <PageHeader title="My Attempts" />
        <Card className="mt-8 flex items-center justify-center text-[var(--danger)] bg-[rgb(180_35_24_/_0.08)] border-[rgb(180_35_24_/_0.3)]">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </Card>
      </div>
    );
  }

  // --- Main Content ---
  return (
    <div>
      <PageHeader
        title="My Attempts"
        subtitle="Review previous scores and completion times."
      />

      {attempts.length === 0 ? (
        // --- No Attempts Message ---
        <Card className="text-center text-[var(--muted)] mt-12">
          <ListChecks size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">No Attempts Yet</h3>
          <p className="text-sm mb-6">You haven't attempted any quizzes. Why not try one now?</p>
          <Button as={Link} to="/study">
            Start Studying
          </Button>
        </Card>
      ) : (
        // --- List of Attempts (Using previous working display logic) ---
        <div className="mt-6 space-y-4">
          {attempts.map((attempt) => {
            // Calculate percentage assuming attempt.score is the COUNT
            const percentage = calculatePercentage(attempt.score, attempt.totalQuestions);
            const scoreColor = percentage >= 70 ? 'text-green-600' : percentage >= 40 ? 'text-yellow-600' : 'text-red-600'; // Color based on calculated percentage

            return (
              <Card
                key={attempt._id}
                className="overflow-hidden transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  {/* Left Side: Title and Date */}
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text)] truncate" title={attempt.quizTitle}>
                      {attempt.quizTitle || 'Quiz Title Missing'}
                    </h3>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {/* Use formatDistanceToNow for relative dates */}
                      Completed: {formatDistanceToNow(new Date(attempt.completedAt), { addSuffix: true })}
                    </p>
                  </div>
                  {/* Right Side: Score (Count / Total and Percentage) */}
                  <div className="text-right flex-shrink-0 mt-2 sm:mt-0">
                    <p className="text-xl font-bold text-[var(--text)]">
                      {/* Display score as COUNT / TOTAL */}
                      {attempt.score} / {attempt.totalQuestions}
                    </p>
                    <Badge className={`mt-1 ${scoreColor}`}>
                      {/* Display calculated percentage */}
                      ({percentage}%)
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyAttempts;
