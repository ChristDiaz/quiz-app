// /home/christian/gpt-quiz-app/client/src/components/PageHeader.jsx
import React from 'react';
import PropTypes from 'prop-types'; // Optional, but recommended for prop validation

/**
 * A reusable component to display a styled page header (h1).
 * Applies consistent styling using Tailwind CSS.
 */
function PageHeader({ title }) {
  return (
    <h1 className="text-3xl font-semibold text-[#2980b9] border-b border-gray-300 pb-4 mb-8">
      {title}
    </h1>
  );
}

// Define prop types for the component (optional but good practice)
PageHeader.propTypes = {
  /** The text content to display as the page title */
  title: PropTypes.string.isRequired,
};

export default PageHeader;
// This component is a simple header that can be reused across different pages.
// It uses Tailwind CSS for styling, ensuring a consistent look and feel.
// The component accepts a `title` prop, which is the text to be displayed.
// The header is styled with a specific font size, weight, color, and bottom border.
// The `PageHeader` component can be imported and used in various parts of the application,
// providing a consistent header style throughout the app.