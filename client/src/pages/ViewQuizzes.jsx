import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import PageHeader from '../components/PageHeader'; // Import the PageHeader component

function ViewQuizzes() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true); // Add loading state
  const [error, setError] = useState(null); // Add error state

  // --- Define Consistent Button Styles (Adapted for card size) ---

  // Primary (Blue - for Edit)
  const primaryButtonClasses = "bg-[#2980b9] text-white px-3 py-1 rounded text-sm hover:bg-[#2573a6] text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6]";

  // Secondary (Gray - for View)
  const secondaryButtonClasses = "bg-gray-300 text-gray-800 px-3 py-1 rounded text-sm hover:bg-gray-400 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400";

  // Tertiary (Red - for Delete)
  const deleteButtonClasses = "bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600";

  // --- End Button Styles ---

  useEffect(() => {
    const fetchQuizzes = async () => {
      setLoading(true); // Start loading
      setError(null); // Reset error
      try {
        const response = await axios.get('/api/quizzes');
        setQuizzes(response.data);
      } catch (err) {
        console.error('Error fetching quizzes:', err);
        setError('Failed to load quizzes. Please try again later.'); // Set error message
      } finally {
        setLoading(false); // End loading regardless of success/failure
      }
    };

    fetchQuizzes();
  }, []); // Empty dependency array means this runs once on mount

  const handleDelete = async (id) => {
    // Find the quiz title for the confirmation message
    const quizToDelete = quizzes.find((quiz) => quiz._id === id);
    const quizTitle = quizToDelete ? quizToDelete.title : 'this quiz';

    if (window.confirm(`Are you sure you want to delete "${quizTitle}"? This action cannot be undone.`)) {
      try {
        await axios.delete(`/api/quizzes/${id}`);
        // Update state by filtering out the deleted quiz
        setQuizzes(currentQuizzes => currentQuizzes.filter((quiz) => quiz._id !== id));
        // Optionally show a success message
      } catch (err) {
        console.error('Error deleting quiz:', err);
        // Show an error message to the user
        alert(`Failed to delete quiz: ${err.response?.data?.message || err.message}`);
      }
    }
  };

  return (
    <div className="p-8">
      {/* Use the PageHeader component */}
      <PageHeader title="All Quizzes" />

      {/* Loading State */}
      {loading && (
        <div className="text-center text-gray-500 py-10">
          <p className="animate-pulse">Loading quizzes...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center text-red-600 bg-red-100 p-4 rounded border border-red-300">
          <p>{error}</p>
        </div>
      )}

      {/* Quiz Grid - Only show if not loading and no error */}
      {!loading && !error && (
        <>
          {quizzes.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p>No quizzes found. Why not <Link to="/create-quiz" className="text-blue-600 hover:underline">create one</Link>?</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div key={quiz._id} className="border border-gray-300 rounded-lg p-4 bg-white shadow hover:shadow-md transition flex flex-col justify-between"> {/* Added border color, rounded-lg */}
                  {/* Card Content */}
                  <div>
                    <h2 className="text-lg font-semibold text-[#2980b9] mb-1 truncate" title={quiz.title}>{quiz.title}</h2> {/* Added truncate */}
                    <p className="text-gray-600 text-sm mt-1 mb-4 line-clamp-3">{quiz.description || <span className="italic text-gray-400">No description provided.</span>}</p> {/* Added line-clamp */}
                  </div>
                  {/* Card Footer */}
                  <div>
                    <p className="text-gray-400 text-xs mb-3">{quiz.questions?.length || 0} questions</p> {/* Added null check, adjusted spacing */}
                    <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3"> {/* Added border-t */}
                      <Link
                        to={`/quiz/${quiz._id}`}
                        // Apply the SECONDARY (Gray) style to VIEW
                        className={secondaryButtonClasses}
                      >
                        View
                      </Link>
                      <Link
                        to={`/quiz/${quiz._id}/edit`}
                        // Apply the PRIMARY (Blue) style to EDIT
                        className={primaryButtonClasses}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(quiz._id)}
                        // Apply the TERTIARY (Red) style to DELETE
                        className={deleteButtonClasses}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ViewQuizzes;
