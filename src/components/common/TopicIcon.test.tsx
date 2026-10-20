import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TopicIcon, AVAILABLE_TOPIC_ICONS } from './TopicIcon';

describe('TopicIcon', () => {
  it('renders known icons correctly (e.g., Waves, Dumbbell)', () => {
    const { container: wavesContainer } = render(<TopicIcon name="Waves" data-testid="icon-waves" />);
    expect(wavesContainer.querySelector('svg')).toBeInTheDocument();

    const { container: dumbbellContainer } = render(<TopicIcon name="Dumbbell" data-testid="icon-dumbbell" />);
    expect(dumbbellContainer.querySelector('svg')).toBeInTheDocument();
  });

  it('falls back to Briefcase when icon name is unknown or missing', () => {
    const { container } = render(<TopicIcon name="NonExistentIcon" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('includes Waves in AVAILABLE_TOPIC_ICONS for swimming', () => {
    const wavesOption = AVAILABLE_TOPIC_ICONS.find((opt) => opt.name === 'Waves');
    expect(wavesOption).toBeDefined();
    expect(wavesOption?.label).toMatch(/Natación|Agua/i);
  });
});
