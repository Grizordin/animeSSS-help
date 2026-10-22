// Synthetic, minimal site markup: no captured scripts, tokens, cookies or account data.
const profile='<div class="ap-profile-actions"><a class="ap-profile-action" href="/user/BETEP_B_TYMAHE/">Мой профиль</a></div>';
const owners=profile+'<div class="card-show__owner-wrapper">'+['BETEP_B_TYMAHE','Lily','Lily','AriyaRoses','EliasDorner','Graff 007'].map(name=>`<a class="card-show__owner" href="/user/cards/?name=${encodeURIComponent(name)}"><div class="card-show__owner-image"></div><div class="card-show__owner-name">${name}</div><span class="suite-owner-restriction-icons"></span></a>`).join('')+'</div>';
const form=(name,body)=>`<div id="tradeOffer" data-receiver="${name}" data-trade-id="42" data-original-id="64120"><div class="to-art-stage"><a class="noffer__img" href="/cards/users/?id=64120"></a></div>${body}</div>`;
const history=(name,kind,dates,gained,lost)=>{
 const query=`name=BETEP_B_TYMAHE&trader=${name}${kind?'&kind='+kind:''}`;
 return `<span class="kind_active"><a href="/trades/history/?${query}">История</a></span><div class="history__list">`+dates.map(date=>`<div class="history__item"><div class="history__name"><a href="/user/${name}/">${name}</a></div><div class="history__date">${date}</div><div class="history__body--gained"><a class="history__body-item" href="/cards/users/?id=${gained}"></a></div><div class="history__body--lost"><a class="history__body-item" href="/cards/users/?id=${lost}"></a></div></div>`).join('')+`</div><div id="pagination"><a href="/trades/history/page/2/?${query}">2</a></div>`;
};
const podium='<div class="leaderboard-top__list"><a class="leaderboard-top__item" href="/user/PodiumUser/">Медалист</a><a class="leaderboard-top__item" href="#">Свободно</a></div>';
const trade={
 owners,
 form:form('DoMack','<button class="trade__send-trade-btn">Отправить</button>'),
 success:form('Sonechkka','<div class="message-info__content">Обмен отправлен, дождитесь его рассмотрения получателем</div>'),
 limit:form('Peer','<div class="message-info__title">Достигнут лимит предложений</div>'),
 offers:'<a class="ncard__tabs-btn" href="/trades/offers/">Отправленные (5)</a><div class="trade__list">'+['.executeme','Peer2','Peer3','Peer4','Peer5'].map((name,i)=>`<a class="trade__list-item" href="/trades/offers/${900+i}/"><div class="trade__list-name">для ${name}</div><div class="trade__list-date">17.10.2026 10:00:0${i}</div></a>`).join('')+'</div>',
 history:history('Upuk3412','',['17.10.2026 10:03:00','17.10.2026 10:02:00','17.10.2026 10:01:00','16.10.2026 23:59:00','16.10.2026 23:58:00'],'23378','9441'),
 cancelled:history('detaua','calsel_sender',['18.10.2026 06:59:27'],'14404','7'),
 notices:'<div class="dropdown-item" id="delete-1"><div class="small text-gray-500">17.10.2026 10:00:00</div><span class="font-weight-bold"><a href="/user/Predator/">Predator</a> отказался от вашего предложения на обмен</span></div><div class="dropdown-item" id="delete-2"><div class="small text-gray-500">17.10.2026 10:00:01</div><span class="font-weight-bold"><a href="/user/Peer/">Peer</a> написал сообщение</span></div>'
};
module.exports={trade,variants:{stars:owners+podium,awakened:owners+podium},labyrinth:`<div class="labyrinth__arena"><div id="lm-arena-bar"><div class="lm-ab-right">HUD</div></div><div class="v2-mapbar"><div><b>Карта лабиринта</b><small>Выберите соседнюю комнату</small></div><div class="v2-zoom"><button>−</button><button>Ближе</button><button>+</button></div></div><div id="labyrinthMapViewport" class="labyrinth-map-viewport"><div class="labyrinth-emission is-active"><div class="labyrinth-emission__banner"><div class="labyrinth-emission__label">ВЫБРОС</div>Лабиринт нестабилен</div></div><div id="labyrinthMap" class="labyrinth-map">${'<div class="labyrinth-cell">?</div>'.repeat(5)}</div><div class="lr-map-key"><span>Вы здесь</span></div></div></div>`};
