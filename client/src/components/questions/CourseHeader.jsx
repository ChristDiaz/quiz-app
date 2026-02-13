import styles from './CourseHeader.module.css';

function CourseHeader({ category, title, subtitle, tags = [] }) {
  const visibleTags = Array.isArray(tags) ? tags.filter(Boolean).slice(0, 6) : [];

  return (
    <section className={styles.header}>
      <div className={styles.inner}>
        {category ? <p className={styles.category}>{category}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {visibleTags.length > 0 ? (
          <div className={styles.tags} aria-label="Course topics">
            {visibleTags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default CourseHeader;
