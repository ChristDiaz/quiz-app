import React from 'react';
import { Link } from 'react-router-dom';
import { PencilLine, BookOpen, Timer } from 'lucide-react'; // Import relevant icons
import PageHeader from '../components/PageHeader'; // Import the PageHeader component
import { Button, Card } from '../components/ui';

function Dashboard() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Access your core quiz workflows from one place."
      />

      {/* Dashboard Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* Card 1: Create Quiz */}
        <Card className="h-full flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <PencilLine className="w-8 h-8 text-[#2980b9]" />
            <h2 className="text-xl font-semibold text-[var(--text)]">Create</h2>
          </div>
          <p className="text-[var(--muted)] text-sm">
            Design a new quiz with various question types.
          </p>
          <div className="mt-auto pt-6">
            <Button as={Link} to="/create-quiz">
              Create New Quiz
            </Button>
          </div>
        </Card>

        {/* Card 2: View/Manage Quizzes */}
        <Card className="h-full flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-8 h-8 text-[#2980b9]" />
            <h2 className="text-xl font-semibold text-[var(--text)]">Manage</h2>
          </div>
          <p className="text-[var(--muted)] text-sm">
            View, edit, or delete your existing quizzes.
          </p>
          <div className="mt-auto pt-6">
            <Button as={Link} to="/view-quizzes">
              View My Quizzes
            </Button>
          </div>
        </Card>

        {/* Card 3: Study/Timed Quizzes (Example) */}
        <Card className="h-full flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Timer className="w-8 h-8 text-[#2980b9]" />
            <h2 className="text-xl font-semibold text-[var(--text)]">Practice</h2>
          </div>
          <p className="text-[var(--muted)] text-sm">
            Take timed quizzes or study at your own pace.
          </p>
          {/* Link to specific practice pages */}
          <div className="mt-auto pt-6 flex flex-wrap gap-2">
             <Button as={Link} to="/study">
                Study Mode
             </Button>
             <Button as={Link} to="/timed-quizzes" variant="secondary">
                Timed Mode
             </Button>
          </div>
        </Card>

        {/* Add more cards/widgets as needed */}

      </div>
    </div>
  );
}

export default Dashboard;
