import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import QuestionImageLightbox from '../src/components/QuestionImageLightbox';

describe('QuestionImageLightbox', () => {
  it('opens and closes the lightbox', () => {
    render(
      <QuestionImageLightbox
        src="https://example.com/question-image.jpg"
        alt="Question 1 preview"
        imageClassName="max-h-40"
      />
    );

    const openButton = screen.getByRole('button', { name: 'Open image preview' });
    fireEvent.click(openButton);

    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close image preview' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the lightbox when Escape is pressed', () => {
    render(
      <QuestionImageLightbox
        src="https://example.com/question-image.jpg"
        alt="Question 2 preview"
        imageClassName="max-h-40"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open image preview' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides itself when image load fails', () => {
    render(
      <QuestionImageLightbox
        src="https://example.com/question-image.jpg"
        alt="Broken preview"
        imageClassName="max-h-40"
      />
    );

    fireEvent.error(screen.getByAltText('Broken preview'));

    expect(screen.queryByRole('button', { name: 'Open image preview' })).toBeNull();
  });
});
