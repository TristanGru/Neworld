import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import EntityProfile from './EntityProfile';

interface Props {
  entityId: string;
}

export default function EntityProfilePanel({ entityId }: Props) {
  const entities = useProjectStore((s) => s.entities);
  const categories = useProjectStore((s) => s.entityCategories);
  const setActiveEntity = useUIStore((s) => s.setActiveEntity);

  const entity = entities.find((e) => e.id === entityId);
  if (!entity) return null;

  const category = categories.find((c) => c.id === entity.category_id);

  return (
    <div
      className="w-80 border-l overflow-y-auto flex-shrink-0"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      <EntityProfile
        entity={entity}
        category={category}
        onClose={() => setActiveEntity(null)}
      />
    </div>
  );
}
