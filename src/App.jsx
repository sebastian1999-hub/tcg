import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Grid2X2,
  LayoutList,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Repeat2,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";
import AccountPage from "./components/AccountPage";
import { supabase } from "./lib/supabase";
import "./App.css";

const cardImage = (name) =>
  `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;

const cardGames = {
  magic: { label: "Magic: The Gathering", importLabel: "Buscar en Scryfall" },
  pokemon: { label: "Pokemon", importLabel: "Buscar en TCGdex" },
  star_wars_unlimited: { label: "Star Wars Unlimited", importLabel: "Buscar en SWUAPI" },
  riftbound: { label: "Riftbound", importLabel: "Anadir carta" },
};

const locationLabel = (profile) =>
  [profile?.locality, profile?.province, profile?.community]
    .filter(Boolean)
    .join(", ");

function ProfileAvatar({ profile }) {
  return (
    <span className="profile-dot">
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt={`Foto de ${profile.name}`} />
      ) : (
        profile.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

const cardStatuses = {
  en_mazo: { label: "En mazo", available: false, listedForTrade: false },
  trade: { label: "Trade", available: true, listedForTrade: true },
  coleccion: { label: "Coleccion", available: true, listedForTrade: false },
};

const cardStatusFor = (card) =>
  card.status || (card.listedForTrade ? "trade" : card.available ? "coleccion" : "en_mazo");

function CardTile({ card, list = false, selected = false, onSelect }) {
  return (
    <button
      type="button"
      className={`card-item ${list ? "card-row" : ""} ${selected ? "selected" : ""}`}
      onClick={() => onSelect(card)}
    >
      <div className="card-art">
        <img
          src={card.image || cardImage(card.name)}
          alt={`Ilustracion de ${card.name}`}
        />
        <span className={`availability ${cardStatusFor(card) === "en_mazo" ? "unavailable" : ""}`}>
          {cardStatuses[cardStatusFor(card)].label}
        </span>
      </div>
      <div className="card-info">
        <h3>{card.name}</h3>
        <p>{card.set || "Edicion sin especificar"}</p>
        <strong>{card.value || "---"} EUR</strong>
      </div>
      {list && <span className="row-rarity">{card.rarity}</span>}
    </button>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [collection, setCollection] = useState([]);
  const [offers, setOffers] = useState([]);
  const [tradeRequests, setTradeRequests] = useState([]);
  const [tradeDraft, setTradeDraft] = useState(null);
  const [tradeDetail, setTradeDetail] = useState(null);
  const [isTradeSaving, setIsTradeSaving] = useState(false);
  const [tradeMessages, setTradeMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isChatSaving, setIsChatSaving] = useState(false);
  const [page, setPage] = useState("home");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState("magic");
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("Todas");
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedCardIds, setSelectedCardIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [detailCard, setDetailCard] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshData(activeSession) {
    if (!activeSession || !supabase) return;

    const [cardsResult, offersResult, tradesResult] = await Promise.all([
      supabase
        .from("collection_cards")
        .select(
          "card_id, game, name, set_name, rarity, image_url, estimated_value, available, listed_for_trade, card_status, quantity",
        )
        .eq("user_id", activeSession.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("collection_cards")
        .select(
          "user_id, card_id, game, name, set_name, rarity, image_url, estimated_value, available, quantity, profiles(display_name, community, province, locality, avatar_url, completed_trades)",
        )
        .eq("listed_for_trade", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("trade_offers")
        .select("id, sender_id, recipient_id, parent_offer_id, sender_cards, recipient_cards, status, created_at, sender:profiles!trade_offers_sender_id_fkey(display_name, avatar_url), recipient:profiles!trade_offers_recipient_id_fkey(display_name, avatar_url)")
        .order("created_at", { ascending: false }),
    ]);

    if (cardsResult.error) {
      setNotice(
        `No se pudo cargar tu biblioteca: ${cardsResult.error.message}`,
      );
    } else {
      setCollection(
        (cardsResult.data || []).map((card) => ({
          id: card.card_id,
          game: card.game || "magic",
          name: card.name,
          set: card.set_name,
          rarity: card.rarity,
          image: card.image_url,
          value: Number(card.estimated_value || 0).toFixed(2),
          available: card.available,
          listedForTrade: card.listed_for_trade,
          status: card.card_status || (card.listed_for_trade ? "trade" : card.available ? "coleccion" : "en_mazo"),
          quantity: card.quantity,
        })),
      );
    }

    if (offersResult.error) {
      setNotice(
        `No se pudieron cargar los intercambios: ${offersResult.error.message}`,
      );
    } else {
      setOffers(
        (offersResult.data || []).map((card) => ({
          id: `${card.user_id}-${card.card_id}`,
          game: card.game || "magic",
          name: card.name,
          set: card.set_name,
          rarity: card.rarity,
          image: card.image_url,
          value: Number(card.estimated_value || 0).toFixed(2),
          quantity: card.quantity,
          available: card.available,
          owner: {
            id: card.user_id,
            name: card.profiles?.display_name || "Coleccionista",
            community: card.profiles?.community,
            province: card.profiles?.province,
            locality: card.profiles?.locality,
            avatarUrl: card.profiles?.avatar_url,
            trades: card.profiles?.completed_trades || 0,
          },
        })),
      );
    }

    if (tradesResult.error) {
      setNotice(`No se pudieron cargar las ofertas recibidas: ${tradesResult.error.message}`);
    } else {
      setTradeRequests(
        (tradesResult.data || []).map((trade) => ({
          id: trade.id,
          senderId: trade.sender_id,
          recipientId: trade.recipient_id,
          parentOfferId: trade.parent_offer_id,
          senderCards: trade.sender_cards || [],
          recipientCards: trade.recipient_cards || [],
          status: trade.status,
          createdAt: trade.created_at,
          sender: {
            id: trade.sender_id,
            name: trade.sender?.display_name || "Coleccionista",
            avatarUrl: trade.sender?.avatar_url,
          },
          recipient: {
            id: trade.recipient_id,
            name: trade.recipient?.display_name || "Coleccionista",
            avatarUrl: trade.recipient?.avatar_url,
          },
        })),
      );
    }
  }

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return undefined;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setIsAuthLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setCollection([]);
      setOffers([]);
      return;
    }
    refreshData(session);
  }, [session]);

  const allOffers = useMemo(() => {
    const existingOwnOffers = new Set(
      offers
        .filter(
          (offer) =>
            offer.owner.id === session?.user.id && offer.game === selectedGame,
        )
        .map((offer) => offer.id),
    );
    const unpublishedOwnOffers = collection
      .filter(
        (card) =>
          card.listedForTrade &&
          card.game === selectedGame &&
          !existingOwnOffers.has(`${session?.user.id}-${card.id}`),
      )
      .map((card) => ({
        ...card,
        owner: {
          id: session.user.id,
          name:
            session.user.user_metadata.display_name ||
            session.user.email.split("@")[0],
          trades: 0,
        },
      }));
    return [
      ...offers.filter((offer) => offer.game === selectedGame),
      ...unpublishedOwnOffers,
    ];
  }, [collection, offers, selectedGame, session]);

  const visibleCards = useMemo(() => {
    const term = query.toLowerCase();
    return collection.filter(
      (card) =>
        card.game === selectedGame &&
        (card.name.toLowerCase().includes(term) ||
          card.set?.toLowerCase().includes(term)) &&
        (availability === "Todas" ||
          (availability === "Disponibles" && card.available) ||
          (availability === "No disponibles" && !card.available)),
    );
  }, [availability, collection, query, selectedGame]);

  const collectors = useMemo(() => {
    const uniqueCollectors = new Map();
    allOffers.forEach((offer) => {
      if (offer.owner.id !== session?.user.id)
        uniqueCollectors.set(offer.owner.id, offer.owner);
    });
    return [...uniqueCollectors.values()];
  }, [allOffers, session]);

  function openProfile(profile) {
    setSelectedProfile(profile);
    setPage("profile");
  }

  function navigateTo(nextPage) {
    setPage(nextPage);
    setIsMobileNavOpen(false);
  }

  function openTradeComposer(targetOffer, parentOfferId = null) {
    if (targetOffer.owner.id === session.user.id) {
      setNotice("No puedes hacerte una oferta a ti mismo.");
      return;
    }
    setTradeDraft({
      recipient: targetOffer.owner,
      recipientCardIds: new Set([targetOffer.id]),
      ownCardIds: new Set(),
      parentOfferId,
    });
  }

  function toggleTradeDraftCard(side, cardId) {
    setTradeDraft((draft) => {
      const field = side === "own" ? "ownCardIds" : "recipientCardIds";
      const ids = new Set(draft[field]);
      if (ids.has(cardId)) ids.delete(cardId);
      else ids.add(cardId);
      return { ...draft, [field]: ids };
    });
  }

  function snapshotCard(card) {
    return {
      id: card.id,
      game: card.game || selectedGame,
      name: card.name,
      set: card.set,
      image: card.image,
      value: card.value,
      quantity: card.quantity || 1,
    };
  }

  async function sendTradeOffer() {
    if (!tradeDraft?.ownCardIds.size || !tradeDraft.recipientCardIds.size) {
      setNotice("Selecciona al menos una carta de cada coleccion.");
      return;
    }
    const senderCards = collection
      .filter((card) => tradeDraft.ownCardIds.has(card.id))
      .map(snapshotCard);
    const recipientCards = allOffers
      .filter((card) => tradeDraft.recipientCardIds.has(card.id))
      .map(snapshotCard);
    setIsTradeSaving(true);
    const { error } = await supabase.from("trade_offers").insert({
      sender_id: session.user.id,
      recipient_id: tradeDraft.recipient.id,
      parent_offer_id: tradeDraft.parentOfferId,
      sender_cards: senderCards,
      recipient_cards: recipientCards,
    });
    if (!error && tradeDraft.parentOfferId) {
      await supabase
        .from("trade_offers")
        .update({ status: "countered" })
        .eq("id", tradeDraft.parentOfferId);
    }
    setIsTradeSaving(false);
    if (error) {
      setNotice(`No se pudo enviar la oferta: ${error.message}`);
      return;
    }
    setTradeDraft(null);
    setNotice("Oferta enviada.");
    await refreshData(session);
  }

  async function updateTradeStatus(trade, status) {
    setIsTradeSaving(true);
    const { error } = await supabase
      .from("trade_offers")
      .update({ status })
      .eq("id", trade.id);
    setIsTradeSaving(false);
    if (error) {
      setNotice(`No se pudo actualizar la oferta: ${error.message}`);
      return;
    }
    setTradeDetail({ ...trade, status });
    if (status === "accepted") await loadTradeMessages(trade.id);
    setNotice(status === "accepted" ? "Oferta aceptada." : "Oferta rechazada.");
    await refreshData(session);
  }

  async function loadTradeMessages(tradeId) {
    const { data, error } = await supabase
      .from("trade_messages")
      .select("id, sender_id, body, created_at")
      .eq("trade_offer_id", tradeId)
      .order("created_at", { ascending: true });
    if (error) {
      setNotice(`No se pudo cargar el chat: ${error.message}`);
      return;
    }
    setTradeMessages(data || []);
  }

  async function openTradeDetail(trade) {
    setTradeDetail(trade);
    setChatMessage("");
    setTradeMessages([]);
    if (trade.status === "accepted") await loadTradeMessages(trade.id);
  }

  async function sendTradeMessage(event) {
    event.preventDefault();
    const body = chatMessage.trim();
    if (!body || !tradeDetail) return;
    setIsChatSaving(true);
    const { error } = await supabase.from("trade_messages").insert({
      trade_offer_id: tradeDetail.id,
      sender_id: session.user.id,
      body,
    });
    setIsChatSaving(false);
    if (error) {
      setNotice(`No se pudo enviar el mensaje: ${error.message}`);
      return;
    }
    setChatMessage("");
    await loadTradeMessages(tradeDetail.id);
  }

  function openCounterOffer(trade) {
    const targetProfile = trade.senderId === session.user.id ? trade.recipient : trade.sender;
    const targetCards = allOffers.filter((card) => card.owner.id === targetProfile.id);
    const matchingCard = targetCards.find((card) =>
      (trade.senderId === session.user.id ? trade.recipientCards : trade.senderCards)
        .some((snapshot) => snapshot.id === card.id),
    );
    if (!matchingCard) {
      setNotice("La carta original ya no esta disponible para una contraoferta.");
      return;
    }
    setTradeDetail(null);
    openTradeComposer(matchingCard, trade.id);
  }

  async function saveCard(card) {
    const { error } = await supabase.from("collection_cards").upsert(
      {
        user_id: session.user.id,
        card_id: String(card.id),
        game: card.game || selectedGame,
        name: card.name,
        set_name: card.set,
        rarity: card.rarity,
        image_url: card.image,
        estimated_value: Number(card.value || 0),
        available: card.available,
        listed_for_trade: Boolean(card.listedForTrade),
        card_status: cardStatusFor(card),
        quantity: card.quantity || 1,
      },
      { onConflict: "user_id,game,card_id" },
    );
    if (error) {
      setNotice(`No se pudo guardar la carta: ${error.message}`);
      return false;
    }
    return true;
  }

  async function openCardDetail(card) {
    setDetailCard({ ...card, oracleText: "", typeLine: "" });
    setPage("card-detail");
    if (card.game && card.game !== "magic") {
      setIsDetailLoading(false);
      setDetailCard((currentCard) => ({
        ...currentCard,
        oracleText: "Detalle de carta registrado por el coleccionista.",
        typeLine: cardGames[card.game]?.label || "Juego de cartas coleccionables",
      }));
      return;
    }
    setIsDetailLoading(true);
    try {
      const response = await fetch(
        `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.details);
      setDetailCard((currentCard) => ({
        ...currentCard,
        image:
          data.image_uris?.normal || data.card_faces?.[0]?.image_uris?.normal,
        set: data.set_name,
        value: data.prices.eur || data.prices.usd || "---",
        oracleText:
          data.oracle_text ||
          data.card_faces
            ?.map((face) => face.oracle_text)
            .filter(Boolean)
            .join("\n\n") ||
          "Sin texto de reglas.",
        typeLine:
          data.type_line ||
          data.card_faces
            ?.map((face) => face.type_line)
            .filter(Boolean)
            .join(" // "),
      }));
    } catch (error) {
      setNotice(`No se pudo cargar el detalle: ${error.message}`);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function publishSelectedCard() {
    await applySelectedStatus("trade");
  }

  function toggleCardSelection(card) {
    setSelectedCardIds((ids) => {
      const nextIds = new Set(ids);
      if (nextIds.has(card.id)) nextIds.delete(card.id);
      else nextIds.add(card.id);
      return nextIds;
    });
    setSelectedCard(card);
    setNotice("");
  }

  async function applySelectedStatus(status) {
    if (!selectedCardIds.size || !cardStatuses[status]) return;
    const statusDetails = cardStatuses[status];
    const cardIds = [...selectedCardIds];
    const updatedCards = collection.map((card) =>
      cardIds.includes(card.id)
        ? { ...card, status, available: statusDetails.available, listedForTrade: statusDetails.listedForTrade }
        : card,
    );
    setCollection(updatedCards);
    const { error } = await supabase
      .from("collection_cards")
      .update({
        card_status: status,
        available: statusDetails.available,
        listed_for_trade: statusDetails.listedForTrade,
      })
      .eq("user_id", session.user.id)
      .eq("game", selectedGame)
      .in("card_id", cardIds);
    if (error) {
      setCollection(collection);
      setNotice(`No se pudo cambiar el estado: ${error.message}`);
      return;
    }
    setSelectedCardIds(new Set());
    setSelectedCard(null);
    setBulkStatus("");
    setNotice(`${cardIds.length} ${cardIds.length === 1 ? "carta actualizada" : "cartas actualizadas"} a ${statusDetails.label}.`);
    await refreshData(session);
  }

  async function deleteSelectedCards() {
    if (!selectedCardIds.size) return;
    const cardIds = [...selectedCardIds];
    const countLabel = cardIds.length === 1 ? "esta carta" : `estas ${cardIds.length} cartas`;
    if (!window.confirm(`Eliminar ${countLabel} de tu biblioteca? Esta accion no se puede deshacer.`)) return;

    const { error } = await supabase
      .from("collection_cards")
      .delete()
      .eq("user_id", session.user.id)
      .eq("game", selectedGame)
      .in("card_id", cardIds);
    if (error) {
      setNotice(`No se pudieron eliminar las cartas: ${error.message}`);
      return;
    }
    setCollection((cards) => cards.filter((card) => !cardIds.includes(card.id) || card.game !== selectedGame));
    setSelectedCardIds(new Set());
    setSelectedCard(null);
    setBulkStatus("");
    setNotice(`${cardIds.length} ${cardIds.length === 1 ? "carta eliminada" : "cartas eliminadas"} de tu biblioteca.`);
  }

  async function searchScryfall(event) {
    event.preventDefault();
    if (importQuery.trim().length < 2) return;
    setIsSearching(true);
    setSearchError("");
    try {
      if (selectedGame === "pokemon") {
        const response = await fetch(
          `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(importQuery.trim())}`,
        );
        const summaries = await response.json();
        if (!response.ok) throw new Error("No se pudieron buscar las cartas de Pokemon");
        const details = await Promise.all(
          summaries.slice(0, 8).map(async (summary) => {
            const detailResponse = await fetch(
              `https://api.tcgdex.net/v2/en/cards/${summary.id}`,
            );
            return detailResponse.ok ? detailResponse.json() : summary;
          }),
        );
        setSearchResults(
          details.map((card) => ({
            id: card.id,
            game: "pokemon",
            name: card.name,
            set: card.set?.name || "Edicion sin especificar",
            rarity: card.rarity || "Sin especificar",
            value: "0.00",
            image: card.image ? `${card.image}/high.webp` : "",
            available: true,
            quantity: 1,
          })),
        );
        return;
      }
      if (selectedGame === "star_wars_unlimited") {
        const response = await fetch(
          `https://api.swuapi.com/cards?name=${encodeURIComponent(importQuery.trim())}&limit=8`,
        );
        const data = await response.json();
        if (!response.ok) throw new Error("No se pudieron buscar las cartas de Star Wars Unlimited");
        setSearchResults(
          (data.cards || []).slice(0, 8).map((card) => ({
            id: card.uuid,
            game: "star_wars_unlimited",
            name: [card.name, card.subtitle].filter(Boolean).join(", "),
            set: card.set_code || "Edicion sin especificar",
            rarity: card.rarity || "Sin especificar",
            value: "0.00",
            image: card.front_image_url || card.thumbnail_url || "",
            available: true,
            quantity: 1,
          })),
        );
        return;
      }
      if (selectedGame !== "magic") {
        setSearchResults([{
          id: `${selectedGame}-${importQuery.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          game: selectedGame,
          name: importQuery.trim(),
          set: "Edicion sin especificar",
          rarity: "Sin especificar",
          value: "0.00",
          image: "",
          available: true,
          quantity: 1,
        }]);
        return;
      }
      const response = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(importQuery.trim())}&unique=cards`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.details || "No se encontraron cartas");
      setSearchResults(
        data.data.slice(0, 8).map((card) => ({
          id: card.id,
          game: "magic",
          name: card.name,
          set: card.set_name,
          rarity: card.rarity,
          value: card.prices.eur || card.prices.usd || "0.00",
          image:
            card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
          available: true,
          quantity: 1,
        })),
      );
    } catch (error) {
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  }

  async function addCard(card) {
    if (collection.some((item) => item.id === card.id && item.game === (card.game || selectedGame))) {
      setNotice(`${card.name} ya esta en tu biblioteca.`);
      return;
    }
    const newCard = {
      ...card,
      game: card.game || selectedGame,
      value: Number(card.value || 0).toFixed(2),
      listedForTrade: false,
      status: "coleccion",
    };
    if (await saveCard(newCard)) {
      setCollection((cards) => [newCard, ...cards]);
      setNotice(`${card.name} se ha anadido a tu biblioteca.`);
    }
  }

  function TradeComposerModal() {
    if (!tradeDraft) return null;
    const recipientCards = allOffers.filter(
      (card) => card.owner.id === tradeDraft.recipient.id,
    );
    const ownTradeCards = collection.filter(
      (card) => card.available && card.game === selectedGame,
    );
    return (
      <div className="modal-backdrop" onMouseDown={() => setTradeDraft(null)}>
        <section className="trade-builder-modal" role="dialog" aria-modal="true" aria-labelledby="trade-builder-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" type="button" onClick={() => setTradeDraft(null)} aria-label="Cerrar"><X size={20} /></button>
          <p className="eyebrow"><Send size={14} /> {tradeDraft.parentOfferId ? "CONTRAOFERTA" : "NUEVA OFERTA"}</p>
          <h2 id="trade-builder-title">Oferta para {tradeDraft.recipient.name}</h2>
          <p className="modal-copy">Selecciona las cartas que quieres recibir y las que vas a ofrecer.</p>
          <div className="trade-card-columns">
            <section>
              <div className="trade-card-heading"><h3>Quieres recibir</h3><span>{tradeDraft.recipientCardIds.size} seleccionadas</span></div>
              <div className="trade-card-picker">
                {recipientCards.map((card) => <button type="button" key={card.id} className={tradeDraft.recipientCardIds.has(card.id) ? "active" : ""} onClick={() => toggleTradeDraftCard("recipient", card.id)}><img src={card.image || cardImage(card.name)} alt="" /><span>{card.name}</span></button>)}
              </div>
            </section>
            <section>
              <div className="trade-card-heading"><h3>Tu ofreces</h3><span>{tradeDraft.ownCardIds.size} seleccionadas</span></div>
              <div className="trade-card-picker">
                {ownTradeCards.map((card) => <button type="button" key={card.id} className={tradeDraft.ownCardIds.has(card.id) ? "active" : ""} onClick={() => toggleTradeDraftCard("own", card.id)}><img src={card.image || cardImage(card.name)} alt="" /><span>{card.name}</span></button>)}
                {!ownTradeCards.length && <p className="trade-empty">No tienes cartas disponibles para ofrecer.</p>}
              </div>
            </section>
          </div>
          <button className="send-button" type="button" onClick={sendTradeOffer} disabled={isTradeSaving}><Send size={17} /> {isTradeSaving ? "Enviando..." : "Enviar oferta"}</button>
        </section>
      </div>
    );
  }

  function TradeDetailModal() {
    if (!tradeDetail) return null;
    const isIncoming = tradeDetail.recipientId === session.user.id;
    const counterparty = isIncoming ? tradeDetail.sender : tradeDetail.recipient;
    const theirs = isIncoming ? tradeDetail.senderCards : tradeDetail.recipientCards;
    const yours = isIncoming ? tradeDetail.recipientCards : tradeDetail.senderCards;
    return (
      <div className="modal-backdrop" onMouseDown={() => setTradeDetail(null)}>
        <section className="trade-builder-modal trade-detail-modal" role="dialog" aria-modal="true" aria-labelledby="trade-detail-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="modal-close" type="button" onClick={() => setTradeDetail(null)} aria-label="Cerrar"><X size={20} /></button>
          <p className="eyebrow"><Send size={14} /> OFERTA {tradeDetail.status}</p>
          <h2 id="trade-detail-title">{isIncoming ? `${counterparty.name} te propone un intercambio` : `Oferta para ${counterparty.name}`}</h2>
          <div className="trade-detail-cards">
            <section><h3>{isIncoming ? "Te ofrece" : "Ofreces"}</h3>{theirs.map((card) => <article key={card.id}><img src={card.image || cardImage(card.name)} alt="" /><span>{card.name}</span></article>)}</section>
            <section><h3>{isIncoming ? "A cambio de" : "Solicitas"}</h3>{yours.map((card) => <article key={card.id}><img src={card.image || cardImage(card.name)} alt="" /><span>{card.name}</span></article>)}</section>
          </div>
          {tradeDetail.status === "pending" && <div className="trade-detail-actions">
            {isIncoming && <><button type="button" className="add-button" onClick={() => updateTradeStatus(tradeDetail, "accepted")} disabled={isTradeSaving}><Check size={16} /> Aceptar</button><button type="button" className="trade-reject-button" onClick={() => updateTradeStatus(tradeDetail, "rejected")} disabled={isTradeSaving}><XCircle size={16} /> Rechazar</button></>}
            <button type="button" className="text-button" onClick={() => openCounterOffer(tradeDetail)}><Repeat2 size={16} /> Hacer contraoferta</button>
          </div>}
          {tradeDetail.status === "accepted" && <section className="trade-chat">
            <div className="trade-chat-heading"><MessageCircle size={17} /><div><h3>Chat del intercambio</h3><span>Coordina la entrega con {counterparty.name}.</span></div></div>
            <div className="trade-message-list">
              {tradeMessages.map((message) => <p key={message.id} className={message.sender_id === session.user.id ? "own" : ""}>{message.body}</p>)}
              {!tradeMessages.length && <span className="trade-empty">Aun no hay mensajes. Escribe para coordinar el intercambio.</span>}
            </div>
            <form className="trade-chat-form" onSubmit={sendTradeMessage}>
              <input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="Escribe un mensaje" maxLength="1000" />
              <button type="submit" disabled={!chatMessage.trim() || isChatSaving} aria-label="Enviar mensaje"><Send size={17} /></button>
            </form>
          </section>}
        </section>
      </div>
    );
  }

  function HomePage() {
    const cardsPerPage = 8;
    const latestCards = allOffers.slice(0, cardsPerPage);
    return (
      <main className="home-page">
        <section className="home-intro">
          <p className="eyebrow">
            <Sparkles size={14} /> ACTIVIDAD DE LA COMUNIDAD
          </p>
          <h1>Cartas publicadas por la comunidad</h1>
          <p>
            Las cartas visibles aqui proceden de las bibliotecas reales de los
            usuarios registrados.
          </p>
        </section>
        <section className="request-section">
          <div className="section-title">
            <div>
              <h2>Ultimas publicaciones</h2>
              <p>Ofertas activas para intercambio</p>
            </div>
            <div className="section-actions">
              
              <button
                type="button"
                className="text-button"
                onClick={() => setPage("trades")}
              >
                Ver intercambios <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
          {latestCards.length ? (
            <div className="orbit-wrapper">
              <div
                className="orbit-inner"
                style={{ "--quantity": latestCards.length }}
              >
                {latestCards.map((card, index) => (
                  <button
                    type="button"
                    className="orbit-card"
                    key={card.id}
                    style={{ "--index": index }}
                    onClick={() => openCardDetail(card)}
                    aria-label={`Ver ${card.name}, publicada por ${card.owner.name}`}
                  >
                    <img
                      src={card.image || cardImage(card.name)}
                      alt={`Ilustracion de ${card.name}`}
                    />
                    <span>{card.name}</span>
                    <small>{card.owner.name} · {card.quantity} {card.quantity === 1 ? "copia" : "copias"}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Aun no hay cartas publicadas. Importa una carta y publicala para
              que aparezca aqui.
            </div>
          )}
        </section>
      </main>
    );
  }

  function LibraryPage() {
    return (
      <main>
        <section className="collection-head">
          <div>
            <p className="eyebrow">
              <Sparkles size={14} /> COLECCION DE {cardGames[selectedGame].label.toUpperCase()}
            </p>
            <h1>Tu biblioteca</h1>
            <p className="collection-subtitle">
              Cartas guardadas en tu cuenta de Supabase.
            </p>
          </div>
          <label className="select-box game-selector">
            <select value={selectedGame} onChange={(event) => { setSelectedGame(event.target.value); setSelectedCardIds(new Set()); setQuery(""); }} aria-label="Seleccionar juego">
              {Object.entries(cardGames).map(([game, details]) => <option key={game} value={game}>{details.label}</option>)}
            </select>
            <ChevronDown size={15} />
          </label>
          <div className="library-actions">
            <label className="select-box bulk-status-selector">
              <select
                value={bulkStatus}
                onChange={(event) => {
                  const status = event.target.value;
                  setBulkStatus(status);
                  if (status) applySelectedStatus(status);
                }}
                disabled={!selectedCardIds.size}
                aria-label="Cambiar estado de cartas seleccionadas"
              >
                <option value="">Cambiar estado ({selectedCardIds.size})</option>
                <option value="en_mazo">En mazo</option>
                <option value="trade">Trade</option>
                <option value="coleccion">Coleccion</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="delete-cards-button" type="button" onClick={deleteSelectedCards} disabled={!selectedCardIds.size}>
              <Trash2 size={16} /> Eliminar ({selectedCardIds.size})
            </button>
            <button
              className="add-button"
              type="button"
              onClick={() => setIsImporterOpen(true)}
            >
              <Plus size={17} /> Anadir cartas
            </button>
          </div>
        </section>
        <section className="stats-grid">
          <article>
            <p>Cartas en coleccion</p>
            <strong>{collection.length}</strong>
            <span className="positive">Guardadas en Supabase</span>
          </article>
          <article>
            <p>Valor estimado</p>
            <strong>
              {collection
                .reduce((sum, card) => sum + Number(card.value || 0), 0)
                .toLocaleString("es-ES", { minimumFractionDigits: 2 })}{" "}
              EUR
            </strong>
            <span className="neutral">Precio orientativo</span>
          </article>
          <article>
            <p>Publicadas para trade</p>
            <strong>
              {collection.filter((card) => card.listedForTrade).length}
            </strong>
            <span className="positive">Visibles por la comunidad</span>
          </article>
        </section>
        <section className="workspace">
          <div className="library-panel">
            <div className="section-title">
              <div>
                <h2>Tu coleccion</h2>
                <p>Selecciona una o varias cartas para cambiar su estado.</p>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setAvailability("Todas");
                }}
              >
                Limpiar filtros
              </button>
            </div>
            <div className="toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar carta o edicion"
                />
              </label>
              <label className="select-box">
                <SlidersHorizontal size={17} />
                <select
                  value={availability}
                  onChange={(event) => setAvailability(event.target.value)}
                >
                  <option>Todas</option>
                  <option>Disponibles</option>
                  <option>No disponibles</option>
                </select>
                <ChevronDown size={15} />
              </label>
              <button
                type="button"
                className={`view-button ${view === "grid" ? "active" : ""}`}
                onClick={() => setView("grid")}
                aria-label="Vista de cuadrícula"
              >
                <Grid2X2 size={18} />
              </button>
              <button
                type="button"
                className={`view-button ${view === "list" ? "active" : ""}`}
                onClick={() => setView("list")}
                aria-label="Vista de lista"
              >
                <LayoutList size={19} />
              </button>
            </div>
            <div className={view === "grid" ? "card-grid" : "card-list"}>
              {visibleCards.map((card) => (
                <CardTile
                  key={card.id}
                  card={card}
                  list={view === "list"}
                  selected={selectedCardIds.has(card.id)}
                  onSelect={toggleCardSelection}
                />
              ))}
            </div>
            {!visibleCards.length && (
              <div className="empty-state">
                Tu biblioteca esta vacia. Usa "Anadir cartas" para importarlas
                desde Scryfall.
              </div>
            )}
          </div>
          <aside className="trade-panel">
            <div className="section-title">
              <div>
                <h2>Mi publicacion</h2>
                <p>Haz visible una carta para otros usuarios.</p>
              </div>
            </div>
            <div className="trade-callout">
              <span className="callout-icon">
                <Send size={19} />
              </span>
              <div>
                <h3>{selectedCardIds.size ? `${selectedCardIds.size} ${selectedCardIds.size === 1 ? "carta seleccionada" : "cartas seleccionadas"}` : "Selecciona una carta"}</h3>
                <p>
                  La opcion Trade publicara todas las cartas seleccionadas para los usuarios registrados.
                </p>
              </div>
              <button
                type="button"
                onClick={publishSelectedCard}
                disabled={!selectedCardIds.size}
              >
                Publicar para trade
              </button>
            </div>
            <div className="collector-list">
              {collectors.map((collector) => (
                <article className="collector" key={collector.id}>
                  <button
                    className="collector-profile"
                    type="button"
                    onClick={() => openProfile(collector)}
                  >
                    <ProfileAvatar profile={collector} />
                    <div className="collector-main">
                      <h3>{collector.name}</h3>
                      <p>{locationLabel(collector) || "Ubicacion pendiente"}</p>
                      <span>{collector.trades} trades completados</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label={`Ver perfil de ${collector.name}`}
                    onClick={() => openProfile(collector)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </main>
    );
  }

  function TradesPage() {
    const matchingOffers = allOffers.filter(
      (offer) =>
        offer.name.toLowerCase().includes(query.toLowerCase()) ||
        offer.owner.name.toLowerCase().includes(query.toLowerCase()),
    );
    return (
      <main className="trades-page">
        <section className="collection-head">
          <div>
            <p className="eyebrow">
              <Send size={14} /> MERCADO DE INTERCAMBIOS
            </p>
            <h1>{cardGames[selectedGame].label}</h1>
            <p className="collection-subtitle">
              Ofertas publicadas por usuarios reales de tu comunidad.
            </p>
          </div>
          <div className="trade-game-controls"><label className="select-box game-selector"><select value={selectedGame} onChange={(event) => setSelectedGame(event.target.value)} aria-label="Seleccionar juego"><option value="magic">Magic: The Gathering</option><option value="pokemon">Pokemon</option><option value="star_wars_unlimited">Star Wars Unlimited</option><option value="riftbound">Riftbound</option></select><ChevronDown size={15} /></label><span className="offer-total">{matchingOffers.length} ofertas activas</span></div>
        </section>
        <section className="offer-controls">
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar carta o coleccionista"
            />
          </label>
        </section>
        <section className="offer-grid">
          {matchingOffers.map((offer) => (
            <article className="offer-card" key={offer.id}>
              <button
                type="button"
                className="offer-card-main"
                onClick={() => openCardDetail(offer)}
              >
                <img
                  src={offer.image || cardImage(offer.name)}
                  alt={`Ilustracion de ${offer.name}`}
                />
                <div>
                  <h2>{offer.name}</h2>
                  <p>{offer.set}</p>
                  <strong>{offer.value} EUR</strong>
                </div>
              </button>
              <div className="offer-owner">
                <button type="button" onClick={() => openProfile(offer.owner)}>
                  <ProfileAvatar profile={offer.owner} />
                  <span>
                    <strong>{offer.owner.name}</strong>
                    <small>
                      <MapPin size={12} />{" "}
                      {locationLabel(offer.owner) || "Ubicacion pendiente"} ·{" "}
                      {offer.owner.trades} trades
                    </small>
                  </span>
                </button>
                <span className="offer-quantity">
                  {offer.quantity} {offer.quantity === 1 ? "copia" : "copias"}
                </span>
                <button type="button" className="offer-action" onClick={() => openTradeComposer(offer)}><Send size={15} /> Hacer oferta</button>
              </div>
            </article>
          ))}
        </section>
        {!matchingOffers.length && (
          <div className="empty-state">Aun no hay ofertas publicadas.</div>
        )}
      </main>
    );
  }

  function ProfilePage() {
    const cards = allOffers.filter(
      (offer) => offer.owner.id === selectedProfile.id,
    );
    return (
      <main className="profile-page">
        <button
          type="button"
          className="back-button"
          onClick={() => setPage("trades")}
        >
          <ArrowLeft size={17} /> Volver a intercambios
        </button>
        <section className="profile-hero">
          <span className="profile-dot">
            {selectedProfile.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="eyebrow">
              <Users size={14} /> PERFIL DE COLECCIONISTA
            </p>
            <h1>{selectedProfile.name}</h1>
            <span>
              <MapPin size={14} />{" "}
              {locationLabel(selectedProfile) || "Ubicacion pendiente"}
            </span>
          </div>
        </section>
        <section className="profile-library">
          <div className="section-title">
            <div>
              <h2>Cartas para trade</h2>
              <p>Cartas publicadas por este usuario</p>
            </div>
            <span className="source-note">{cards.length} publicadas</span>
          </div>
          {cards.length ? (
            <div className="card-grid profile-grid">
              {cards.map((card) => (
                <CardTile key={card.id} card={card} onSelect={openCardDetail} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              Este usuario aun no tiene cartas publicadas.
            </div>
          )}
        </section>
      </main>
    );
  }

  function CardDetailPage() {
    const owners = allOffers.filter((offer) => offer.name === detailCard.name);
    return (
      <main className="card-detail-page">
        <button
          type="button"
          className="back-button"
          onClick={() => setPage("trades")}
        >
          <ArrowLeft size={17} /> Volver a intercambios
        </button>
        <section className="card-detail-hero">
          <img
            src={detailCard.image || cardImage(detailCard.name)}
            alt={`Ilustracion de ${detailCard.name}`}
          />
          <div className="card-detail-copy">
            <p className="eyebrow">
              <Sparkles size={14} /> CARTA DE MAGIC: THE GATHERING
            </p>
            <h1>{detailCard.name}</h1>
            <p className="detail-set">
              {detailCard.set} · {detailCard.value} EUR
            </p>
            <div className="oracle-box">
              <span>Texto de reglas</span>
              <p>
                {isDetailLoading
                  ? "Cargando el texto oficial de la carta..."
                  : detailCard.oracleText}
              </p>
              <small>{detailCard.typeLine}</small>
            </div>
          </div>
          <aside className="demand-stat">
            <span>Ofertas activas</span>
            <strong>{owners.length}</strong>
            <p>Publicadas por usuarios reales</p>
          </aside>
        </section>
      </main>
    );
  }

  if (isAuthLoading)
    return (
      <div className="app-shell">
        <main className="account-page">
          <p className="account-copy">Comprobando tu sesion...</p>
        </main>
      </div>
    );
  if (!session)
    return (
      <div className="app-shell">
        <AccountPage
          session={session}
          onSessionChange={setSession}
          onNotice={setNotice}
          tradeRequests={tradeRequests}
          onViewTrade={openTradeDetail}
        />
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    );

  const currentPage =
    page === "home" ? (
      <HomePage />
    ) : page === "library" ? (
      <LibraryPage />
    ) : page === "trades" ? (
      <TradesPage />
    ) : page === "profile" ? (
      <ProfilePage />
    ) : page === "card-detail" ? (
      <CardDetailPage />
    ) : (
      <AccountPage
        session={session}
        onSessionChange={setSession}
        onNotice={setNotice}
        tradeRequests={tradeRequests}
        onViewTrade={openTradeDetail}
      />
    );
  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => navigateTo("home")}>
          <span className="brand-mark">C</span>
          <span>TradingCardGueb</span>
        </button>
        <nav className="main-nav">
          <button
            className={page === "home" ? "active" : ""}
            type="button"
            onClick={() => navigateTo("home")}
          >
            Inicio
          </button>
          <button
            className={page === "library" ? "active" : ""}
            type="button"
            onClick={() => navigateTo("library")}
          >
            Mi biblioteca
          </button>
          <button
            className={page === "trades" ? "active" : ""}
            type="button"
            onClick={() => navigateTo("trades")}
          >
            Intercambios <span className="nav-count">{allOffers.length}</span>
          </button>
        </nav>
        <div className="top-actions">
          <button
            className="icon-button"
            type="button"
            aria-label="Notificaciones"
          >
            <Bell size={19} />
          </button>
          <button
            className="profile-trigger"
            type="button"
            onClick={() => navigateTo("account")}
          >
            <span className="profile-dot">
              {session.user.email.slice(0, 2).toUpperCase()}
            </span>
            <span>{session.user.email.split("@")[0]}</span>
            <ChevronDown size={16} />
          </button>
          <button
            className="icon-button mobile-menu"
            type="button"
            onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-navigation"
            aria-label={isMobileNavOpen ? "Cerrar menu" : "Abrir menu"}
          >
            {isMobileNavOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      {isMobileNavOpen && (
        <nav id="mobile-navigation" className="mobile-navigation" aria-label="Navegacion principal">
          <button className={page === "home" ? "active" : ""} type="button" onClick={() => navigateTo("home")}>Inicio</button>
          <button className={page === "library" ? "active" : ""} type="button" onClick={() => navigateTo("library")}>Mi biblioteca</button>
          <button className={page === "trades" ? "active" : ""} type="button" onClick={() => navigateTo("trades")}>Intercambios <span className="nav-count">{allOffers.length}</span></button>
          <button className={page === "account" ? "active" : ""} type="button" onClick={() => navigateTo("account")}>Mi perfil</button>
        </nav>
      )}
      {currentPage}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {isImporterOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setIsImporterOpen(false)}
        >
          <section
            className="import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setIsImporterOpen(false)}
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
            <p className="eyebrow">{selectedGame === "magic" ? "IMPORTAR DESDE MAGIC" : selectedGame === "pokemon" ? "IMPORTAR DESDE POKEMON" : selectedGame === "star_wars_unlimited" ? "IMPORTAR DESDE STAR WARS UNLIMITED" : `ANADIR ${cardGames[selectedGame].label.toUpperCase()}`}</p>
            <h2 id="import-title">{selectedGame === "riftbound" ? "Registra una carta" : "Busca una carta"}</h2>
            <p className="modal-copy">
              {selectedGame === "magic" ? "Elige una impresion de la base de datos de Scryfall para anadirla a tu biblioteca." : selectedGame === "pokemon" ? "Busca una carta en TCGdex para guardar su nombre, edicion, rareza e imagen." : selectedGame === "star_wars_unlimited" ? "Busca una carta en SWUAPI para guardar su nombre, edicion, rareza e imagen." : "Introduce el nombre de la carta para guardarla en tu biblioteca y poder publicarla para trade."}
            </p>
            <form className="import-search" onSubmit={searchScryfall}>
              <input
                value={importQuery}
                onChange={(event) => setImportQuery(event.target.value)}
                placeholder={selectedGame === "magic" ? "Ej. Sol Ring, set:woe" : selectedGame === "pokemon" ? "Ej. Pikachu, Charizard ex" : selectedGame === "star_wars_unlimited" ? "Ej. Luke Skywalker, Darth Vader" : "Nombre de la carta"}
                autoFocus
              />
              <button type="submit" disabled={isSearching}>
                {isSearching ? "Buscando..." : cardGames[selectedGame].importLabel}
              </button>
            </form>
            {searchError && <p className="search-error">{searchError}</p>}
            <div className="import-results">
              {searchResults.map((card) => (
                <article key={card.id}>
                  <img src={card.image} alt="" />
                  <div>
                    <strong>{card.name}</strong>
                    <span>
                      {card.set} · {card.rarity}
                    </span>
                    <small>{card.value} EUR</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => addCard(card)}
                    aria-label={`Anadir ${card.name}`}
                  >
                    <Plus size={17} />
                  </button>
                </article>
              ))}
            </div>
            {selectedGame === "magic" && <p className="api-credit">
              Datos e imagenes de Scryfall. Magic: The Gathering es propiedad de
              Wizards of the Coast.
            </p>}
            {selectedGame === "pokemon" && <p className="api-credit">
              Datos e imagenes de TCGdex. Pokemon es propiedad de The Pokemon Company.
            </p>}
            {selectedGame === "star_wars_unlimited" && <p className="api-credit">
              Datos e imagenes de SWUAPI. Star Wars Unlimited es propiedad de Fantasy Flight Games y Lucasfilm.
            </p>}
          </section>
        </div>
      )}
      <TradeComposerModal />
      <TradeDetailModal />
    </div>
  );
}

export default App;
