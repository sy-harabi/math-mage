/** Build semantic rows so values never break in the middle of an upgrade. */
export function createUpgradeCard(option, doc = document) {
  const make=(tag,css,text)=>{
    const node=doc.createElement(tag);node.className=css;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const card=make('button','upgrade-option');card.type='button';
  card.dataset.upgradeId=option.id;
  card.dataset.kind=option.kind==='새 스킬'?'learn':'upgrade';
  card.dataset.skill=option.id;
  card.setAttribute('aria-label',`${option.title}, ${option.rank}`);
  const top=make('span','upgrade-top');
  top.append(make('span','upgrade-kind',option.kind),make('span','upgrade-rank',option.rank));
  const header=make('span','upgrade-card-heading');
  const icon=make('span','upgrade-icon');icon.setAttribute('aria-hidden','true');
  if(['bolt','fireball','shield','heal'].includes(option.id)){
    icon.innerHTML=`<svg viewBox="0 0 48 48"><use href="#icon-${option.id}"/></svg>`;
  }else icon.textContent={swiftness:'↗',vitality:'♥',focus:'◷',timeWarp:'◈'}[option.id];
  header.append(icon,make('strong','upgrade-name',option.name));
  const stats=make('span','upgrade-stats');
  for(const item of option.rows){
    const row=make('span','upgrade-stat');
    const values=make('span','upgrade-values');
    row.append(make('span','upgrade-label',item.label));
    if(item.before!==null&&item.before!==item.after){
      values.append(make('span','upgrade-before',item.before),make('span','upgrade-arrow','→'));
    }
    values.append(make('span','upgrade-after',item.after));
    if(item.before===item.after)values.append(make('span','upgrade-unchanged','유지'));
    row.append(values);stats.append(row);
  }
  card.append(top,header,stats);
  if(option.note)card.append(make('small','upgrade-note',option.note));
  return card;
}
