import { forwardRef, useImperativeHandle, useState } from 'react';
import type { Entity } from '../../types';

interface Props {
  items: Entity[];
  command: (item: Entity) => void;
}

const MentionList = forwardRef<any, Props>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div className="mention-autocomplete">
      {items.map((item, index) => (
        <div
          key={item.id}
          className={`mention-item${index === selectedIndex ? ' is-selected' : ''}`}
          onClick={() => command(item)}
        >
          <span>{item.name}</span>
        </div>
      ))}
    </div>
  );
});

MentionList.displayName = 'MentionList';
export default MentionList;
