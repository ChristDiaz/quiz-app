import UiPageHeader from './ui/PageHeader';

function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <UiPageHeader
      title={title}
      subtitle={subtitle}
      actions={actions}
      eyebrow={eyebrow}
    />
  );
}

export default PageHeader;
