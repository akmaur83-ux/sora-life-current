import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

// V2 editorial story block — the single long-form entry point on Home.
//
// Renders only from real admin-configured content (settings.homepage.story).
// There is no fallback copy: an unconfigured store shows no story section,
// which is the required behaviour. Expected shape:
//   { eyebrow, title, body, cta, href, image, alt }
export default function StoryBlock({ story }) {
  if (!story || !story.title || !story.href) return null;
  const { eyebrow, title, body, cta, href, image, alt } = story;

  return (
    <Link to={href} className="v2-story">
      <div className="v2-story__b">
        {eyebrow && <p className="v2-eyebrow">{eyebrow}</p>}
        <h3 className="v2-story__h">{title}</h3>
        {body && <p className="v2-story__p">{body}</p>}
        <span className="v2-story__lk">
          {cta || 'Read the story'} <Icon name="arrowRight" size={12} stroke={1.8} />
        </span>
      </div>
      <div className="v2-story__m">
        <div className="v2-pimg">
          {image && <img src={image} alt={alt || ''} loading="lazy" decoding="async" />}
        </div>
      </div>
    </Link>
  );
}
