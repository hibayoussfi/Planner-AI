import { useState } from 'react';
import { DatePickerField } from '../components/DatePickerField';
import { Body, Button, Card, Choices, Field, Heading, Notice, Page } from '../components/ui';
import { validateTask, type Category, type Task } from '../core/planner';
import { usePlanner } from '../state/PlannerProvider';
import { newId } from '../core/id';
export default function Tasks() {
  const { state, update } = usePlanner();
  const [title, setTitle] = useState(''), [minutes, setMinutes] = useState('45'), [deadline, setDeadline] = useState('');
  const [category, setCategory] = useState<Category>('work'), [priority, setPriority] = useState('Normal'), [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const clear = () => { setTitle(''); setDeadline(''); setEditing(null); setError(''); };
  const save = () => {
    try {
      const task: Task = { id: editing ?? newId(), title: title.trim(), minutes: Number(minutes), deadline: deadline.trim() || null, category, priority: priority === 'High' ? 3 : priority === 'Normal' ? 2 : 1, done: state.tasks.find(t => t.id === editing)?.done ?? false };
      validateTask(task);
      update(st => ({ ...st, tasks: editing ? st.tasks.map(t => t.id === editing ? task : t) : [...st.tasks, task], approved: editing ? st.approved.filter(b => b.taskId !== editing) : st.approved })); clear();
    } catch (e) { setError((e as Error).message); }
  };
  return <Page eyebrow="CAPTURE / PRIORITISE / MAKE SPACE" title="Your priorities." subtitle="Give each task a realistic duration. A workout is a priority too.">
    <Card><Heading>{editing ? 'Edit task' : 'Add a task'}</Heading><Field label="What needs doing?" value={title} onChangeText={setTitle} maxLength={160} placeholder="Prepare for an interview" />
      <Field label="Duration in minutes" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" /><DatePickerField label="Deadline (optional)" value={deadline} onChange={setDeadline} optional />
      <Choices label="Category" values={['work', 'personal', 'fitness']} value={category} onChange={setCategory} /><Choices label="Priority" values={['Low', 'Normal', 'High']} value={priority} onChange={setPriority} />
      {!!error && <Notice danger text={error} />}<Button title={editing ? 'Save changes' : 'Add task'} onPress={save} />{editing && <Button title="Cancel editing" secondary onPress={clear} />}
    </Card>
    {state.tasks.length === 0 && <Body>No tasks yet. Start with one thing you want to make time for.</Body>}
    {state.tasks.map(t => <Card key={t.id}><Heading>{t.done ? '✓ ' : ''}{t.title}</Heading><Body>{t.minutes} min · {t.category} · {['', 'Low', 'Normal', 'High'][t.priority]} priority{t.deadline ? ` · Due ${t.deadline}` : ''}</Body><Button secondary title={t.done ? 'Reopen task' : 'Mark complete'} onPress={() => update(st => ({ ...st, tasks: st.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x), approved: st.approved.filter(b => b.taskId !== t.id) }))} />
      <Button secondary title="Edit" onPress={() => { setEditing(t.id); setTitle(t.title); setMinutes(String(t.minutes)); setDeadline(t.deadline ?? ''); setCategory(t.category); setPriority(['', 'Low', 'Normal', 'High'][t.priority]); }} />
      <Button secondary title="Delete task" onPress={() => { update(st => ({ ...st, tasks: st.tasks.filter(x => x.id !== t.id), approved: st.approved.filter(b => b.taskId !== t.id) })); if (editing === t.id) clear(); }} />
    </Card>)}
  </Page>;
}
