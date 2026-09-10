import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button.jsx';
import { EmptyState } from '../components/common/Feedback.jsx';

export const NotFoundPage = () => (
  <EmptyState
    icon="🧭"
    title="This page does not exist"
    message="The link may be stale - much like the channels around here."
    action={
      <Link to="/channels">
        <Button>Back to all channels</Button>
      </Link>
    }
  />
);
