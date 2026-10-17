"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { IconArrowUpRight, IconBox, IconFileText, IconLayoutGrid, IconSearch, IconUser, IconX } from "@tabler/icons-react";
import { buildGlobalSearchSections, getGlobalSearchContinuations, getGlobalSearchResults, GLOBAL_SEARCH_LABELS, GLOBAL_SEARCH_TYPES, nextGlobalSearchIndex, normalizeGlobalSearch, type GlobalSearchItem, type GlobalSearchType } from "@/lib/global-search";
import styles from "./global-search.module.css";

const icons = { Apartado: IconLayoutGrid, Cliente: IconUser, Producto: IconBox, Cotizacion: IconFileText };

type Props = { items: GlobalSearchItem[]; allowedRoutes: ReadonlySet<string>; unavailableSources?: string[] };

export function GlobalSearch({ items, allowedRoutes, unavailableSources = [] }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = id + "-results";
  const pathname = usePathname();
  const router = useRouter();
  const sections = useMemo(() => buildGlobalSearchSections(allowedRoutes), [allowedRoutes]);
  const results = useMemo(() => getGlobalSearchResults(items, sections, query), [items, sections, query]);
  const continuations = useMemo(() => getGlobalSearchContinuations(query, allowedRoutes), [query, allowedRoutes]);
  const searchable = items.length > 0 || sections.some(item => item.href !== "/");
  const selectedIndex = results.length ? Math.min(Math.max(0, activeIndex), results.length - 1) : -1;
  const activeId = selectedIndex >= 0 ? id + "-result-" + selectedIndex : undefined;
  const hasQuery = normalizeGlobalSearch(query).length >= 2;

  const openSearch = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    setIsOpen(true);
    inputRef.current?.focus();
  }, []);

  function closeSearch() { dialogRef.current?.close(); }

  useEffect(() => {
    if (!searchable) return;
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        const currentDialog = document.querySelector("dialog[open]");
        if (currentDialog && currentDialog !== dialogRef.current) return;
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [openSearch, searchable]);

  useEffect(() => { dialogRef.current?.close(); }, [pathname]);
  useEffect(() => {
    if (dialogRef.current?.open && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId, query]);

  function inputKeys(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(nextGlobalSearchIndex(selectedIndex, results.length, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const selected = results[selectedIndex];
      if (selected) { closeSearch(); router.push(selected.href); }
    }
  }

  if (!searchable) return null;

  return (
    <div className={styles.root}>
      <button type="button" className={styles.trigger} onClick={openSearch} aria-label="Buscar en el programa" aria-haspopup="dialog" aria-expanded={isOpen}>
        <IconSearch size={17} aria-hidden="true" /><span>Buscar en el programa…</span><kbd>Ctrl K</kbd>
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={id + "-title"} onClose={() => { setIsOpen(false); setQuery(""); setActiveIndex(0); }} onClick={event => { if (event.target === event.currentTarget) closeSearch(); }}>
        <div className={styles.heading}><h2 id={id + "-title"}>Buscar en el programa</h2><button type="button" className={styles.close} aria-label="Cerrar búsqueda" onClick={closeSearch}><IconX size={19} aria-hidden="true" /></button></div>
        <div className={styles.inputLine}>
          <IconSearch size={20} aria-hidden="true" />
          <label className={styles.srOnly} htmlFor={id + "-input"}>Nombre, documento, código o apartado</label>
          <input ref={inputRef} id={id + "-input"} type="search" role="combobox" value={query} maxLength={120} autoComplete="off" spellCheck={false} aria-autocomplete="list" aria-controls={listId} aria-expanded={isOpen} aria-activedescendant={activeId} aria-describedby={id + "-hint"} placeholder="Nombre, documento, código o apartado…" onChange={event => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={inputKeys} />
        </div>
        <p className={styles.hint} id={id + "-hint"}>{hasQuery ? "Apartados y coincidencias entre tus registros recientes." : query ? "Escribe al menos 2 caracteres para buscar registros." : "Ve a un apartado o busca clientes, productos y cotizaciones."}</p>
        {unavailableSources.length > 0 ? <p className={styles.warning} role="status">No se pudo cargar: {unavailableSources.join(", ")}. Puedes abrir sus apartados.</p> : null}
        <div className={styles.results} id={listId} role="listbox" aria-label={hasQuery ? "Resultados de búsqueda" : "Accesos rápidos"}>
          {results.length === 0 ? <div className={styles.empty}><IconSearch size={24} aria-hidden="true" /><strong>Sin coincidencias directas</strong><p>{continuations.length > 0 ? "Puedes buscar en el historial completo desde los enlaces de abajo." : "Prueba otro nombre de apartado."}</p></div> : GLOBAL_SEARCH_TYPES.map((type: GlobalSearchType) => {
            const group = results.filter(item => item.type === type);
            if (!group.length) return null;
            const Icon = icons[type];
            return <div key={type} role="group" aria-label={GLOBAL_SEARCH_LABELS[type]}>
              <p className={styles.groupLabel}>{type === "Apartado" && !hasQuery ? "Ir a un apartado" : GLOBAL_SEARCH_LABELS[type]}</p>
              {group.map(item => {
                const index = results.indexOf(item);
                return <Link key={item.type + item.href + item.label} id={id + "-result-" + index} role="option" aria-selected={index === selectedIndex} tabIndex={-1} href={item.href} className={styles.result} data-type={item.type} onPointerEnter={event => { if (event.pointerType !== "touch") setActiveIndex(index); }} onClick={closeSearch}>
                  <span className={styles.resultIcon}><Icon size={20} stroke={1.7} aria-hidden="true" /></span><span className={styles.resultCopy}><strong>{item.label}</strong><span>{item.detail}</span></span><IconArrowUpRight className={styles.resultArrow} size={16} aria-hidden="true" />
                </Link>;
              })}
            </div>;
          })}
        </div>
        {hasQuery && continuations.length > 0 ? <div className={styles.continuations}><p>Para consultar todo el historial</p>{continuations.map(link => <Link key={link.href} href={link.href} onClick={closeSearch}>{link.label}<IconArrowUpRight size={13} aria-hidden="true" /></Link>)}</div> : null}
        <div className={styles.footer}><span className={styles.keyboardHint}>↑ ↓ elegir <span>·</span> Enter abrir <span>·</span> Esc cerrar</span><span>{results.length} {hasQuery ? "coincidencias mostradas" : "accesos"}</span></div>
        <p className={styles.srOnly} role="status" aria-live="polite">{results.length} {hasQuery ? "coincidencias mostradas" : "accesos disponibles"}</p>
      </dialog>
    </div>
  );
}
