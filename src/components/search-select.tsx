'use client';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './search-select.module.css';
export type SelectOption = { value: string; label: string };
export function SearchSelect({ name, label, options, defaultValue = '', value, onChange, required = false, allowCustom = false, maxLength = 200 }: {
  name: string; label: string; options: readonly SelectOption[]; defaultValue?: string; value?: string;
  onChange?: (value: string) => void; required?: boolean; allowCustom?: boolean; maxLength?: number;
}) {
  const id=useId();
  const input=useRef<HTMLInputElement>(null);
  const [local,setLocal]=useState(defaultValue);
  const [query,setQuery]=useState<string|null>(null);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(-1);
  const selected=value ?? local;
  const selectedLabel=options.find(o=>o.value===selected)?.label;
  const text=query ?? selectedLabel ?? (allowCustom ? selected : '');
  const matches=options.filter(o=>o.label.toLocaleLowerCase().includes((query ?? '').toLocaleLowerCase()) || o.value.toLocaleLowerCase().includes((query ?? '').toLocaleLowerCase()));
  function change(next:string) { setLocal(next); onChange?.(next); }
  function choose(option:SelectOption) {
    if(input.current?.matches(':disabled')) return;
    change(option.value); setQuery(null); setOpen(false); setActive(-1); input.current?.focus();
  }
  useEffect(()=>{
    input.current?.setCustomValidity(!allowCustom && text && (!selectedLabel || query!==null) ? 'Choose an option from the list.' : '');
  },[allowCustom,text,selectedLabel,query]);
  useEffect(()=>{
    const form=input.current?.form;
    const reset=()=>{setLocal(defaultValue);setQuery(null);setOpen(false);setActive(-1);};
    form?.addEventListener('reset',reset);
    return ()=>form?.removeEventListener('reset',reset);
  },[defaultValue]);
  useEffect(()=>{if(open && active>=0) document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'});},[open,active,id]);
  return <div className={styles.root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)){setOpen(false);setActive(-1);}}}>
    <input type="hidden" name={name} value={selected} />
    <div className={styles.control}>
      <input ref={input} role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={open && active>=0 && matches[active] ? `${id}-${active}` : undefined}
        value={text} required={required} maxLength={maxLength} autoComplete="off" placeholder="Search or select" onFocus={()=>{setOpen(true);setActive(-1);}}
        onChange={event=>{const next=event.target.value;setQuery(next);change(allowCustom ? next : '');setOpen(true);setActive(-1);}}
        onKeyDown={event=>{
          if(event.key==='ArrowDown' || event.key==='ArrowUp') {event.preventDefault();setOpen(true);setActive(n=>Math.max(0,Math.min(matches.length-1,n+(event.key==='ArrowDown'?1:-1))));}
          else if(event.key==='Enter' && open) {event.preventDefault();if(active>=0 && matches[active])choose(matches[active]);else if(matches.length===1)choose(matches[0]);else setOpen(false);}
          else if(event.key==='Escape' && open) {event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);}
        }} />
      <button type="button" className={styles.toggle} aria-label={`Show options for ${label}`} tabIndex={-1} onClick={()=>{input.current?.focus();setQuery(null);setOpen(!open);setActive(-1);}}>⌄</button>
    </div>
    {open && <div id={`${id}-list`} role="listbox" aria-label={`${label} options`} className={styles.options}>
      {matches.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={selected===option.value} data-active={active===index} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)} className={styles.option}>{option.label}</div>)}
      {!matches.length && <p className={styles.empty}>{allowCustom ? 'No match. Your typed value will be saved.' : 'No matching options.'}</p>}
    </div>}
  </div>;
}
