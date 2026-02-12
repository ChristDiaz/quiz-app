import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditQuiz from '../src/pages/EditQuiz';

const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockNavigate = vi.fn();

vi.mock('axios', () => ({
  default: {
    get: (...args) => mockGet(...args),
    delete: (...args) => mockDelete(...args),
    put: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'quiz-1' }),
    useNavigate: () => mockNavigate,
  };
});

describe('EditQuiz page', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockDelete.mockReset();
    mockNavigate.mockReset();
  });

  it('deletes a question when Delete Question is clicked and confirmed', async () => {
    mockGet.mockResolvedValue({
      data: {
        _id: 'quiz-1',
        title: 'Sample Quiz',
        description: 'Sample description',
        questions: [
          {
            _id: 'question-1',
            questionType: 'multiple-choice',
            questionText: 'Question one text',
            options: ['A', 'B'],
            correctAnswer: 'A',
          },
          {
            _id: 'question-2',
            questionType: 'multiple-choice',
            questionText: 'Question two text',
            options: ['C', 'D'],
            correctAnswer: 'C',
          },
        ],
      },
    });
    mockDelete.mockResolvedValue({ data: { message: 'Question deleted successfully' } });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <EditQuiz />
      </MemoryRouter>
    );

    await screen.findByDisplayValue('Question one text');
    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete Question' });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/api/quizzes/quiz-1/questions/question-1');
    });
    expect(screen.queryByDisplayValue('Question one text')).toBeNull();
    expect(screen.getByDisplayValue('Question two text')).toBeTruthy();
    confirmSpy.mockRestore();
  });
});
