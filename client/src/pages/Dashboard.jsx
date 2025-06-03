import React from 'react';
import { Link } from 'react-router-dom';
import { PencilLine, BookOpen, Timer } from 'lucide-react'; // Import relevant icons
import PageHeader from '../components/PageHeader'; // Import the PageHeader component

function Dashboard() {

  // --- Define Consistent Button/Link Styles (Using Primary Blue for cards) ---
  // Adapted slightly for card links
  const cardLinkClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2980b9] text-white rounded text-sm hover:bg-[#2573a6] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2573a6]";

  return (
    <div className="p-8">
      {/* Use the PageHeader component */}
      <PageHeader title="Dashboard" />

      {/* Dashboard Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Card 1: Create Quiz */}
        <div className="p-6 bg-white border border-gray-300 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-4">
            <PencilLine className="w-8 h-8 text-[#2980b9]" />
            <h2 className="text-xl font-semibold text-gray-700">Create</h2>
          </div>
          <p className="text-gray-600 text-sm mb-5">
            Design a new quiz with various question types.
          </p>
          <Link to="/create-quiz" className={cardLinkClasses}>
            Create New Quiz
          </Link>
        </div>

        {/* Card 2: View/Manage Quizzes */}
        <div className="p-6 bg-white border border-gray-300 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-[#2980b9]" />
            <h2 className="text-xl font-semibold text-gray-700">Manage</h2>
          </div>
          <p className="text-gray-600 text-sm mb-5">
            View, edit, or delete your existing quizzes.
          </p>
          <Link to="/view-quizzes" className={cardLinkClasses}>
            View My Quizzes
          </Link>
        </div>

        {/* Card 3: Study/Timed Quizzes (Example) */}
        <div className="p-6 bg-white border border-gray-300 rounded-lg shadow hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-4">
            <Timer className="w-8 h-8 text-[#2980b9]" />
            <h2 className="text-xl font-semibold text-gray-700">Practice</h2>
          </div>
          <p className="text-gray-600 text-sm mb-5">
            Take timed quizzes or study at your own pace.
          </p>
          {/* Link to specific practice pages */}
          <div className="flex flex-wrap gap-2">
             <Link to="/study" className={cardLinkClasses}>
                Study Mode
             </Link>
             <Link to="/timed-quizzes" className={cardLinkClasses}>
                Timed Mode
             </Link>
          </div>
        </div>

        {/* Add more cards/widgets as needed */}

      </div>
    </div>
  );
}

export default Dashboard;
