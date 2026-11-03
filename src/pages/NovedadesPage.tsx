import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './WelcomePage.css';
import universityIcon from '../assets/images/icon-sgi-fiis.png';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../hooks/useLanguage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { User, ChevronDown, Megaphone, Target, Calendar, BookOpen } from 'lucide-react';
import { callService } from '../services/callService';
import type { CallResponse } from '../services/callService';
import { researchService } from '../services/researchService';
import type { ResearchLine } from '../services/researchService';

// Import news images
import convocatoriasBg from '../assets/images/convocatorias.webp';
import reconocimientoBg from '../assets/images/reconocimineto.webp';
import congresosBg from '../assets/images/congresos.webp';

// Import social logos
import facebookLogo from '../assets/images/logos/logotipo-circular-de-facebook.png';
import linkedinLogo from '../assets/images/logos/linkedin.png';
import whatsappLogo from '../assets/images/logos/whatsapp.png';
import instagramLogo from '../assets/images/logos/instagram.png';

export const NovedadesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('public');
  useLanguage();
  const [activeSection, setActiveSection] = useState('novedades-convocatorias');
  const [calls, setCalls] = useState<CallResponse[]>([]);
  const [allLines, setAllLines] = useState<ResearchLine[]>([]);
  const [loading, setLoading] = useState(true);

  const handleScrollToSection = (id: string) => {
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Escuchar navegación externa y cambiar sección
  useEffect(() => {
    const targetHash = (location.state as any)?.scrollToHash;
    if (targetHash) {
      setActiveSection(targetHash);
    }
    window.scrollTo(0, 0);
  }, [location]);

  // Cargar convocatorias y líneas de investigación del backend
  useEffect(() => {
    setLoading(true);
    Promise.all([
      callService.getAll(),
      researchService.getLines(true).catch(() => [] as ResearchLine[]),
    ])
      .then(([callsData, linesData]) => {
        setAllLines(linesData);

        // Crear un mapa de id => nombre de línea
        const lineMap = new Map<number, string>();
        linesData.forEach((line) => lineMap.set(line.id, line.lineName));

        // Enriquecer las convocatorias con nombres de líneas
        const enriched = callsData.map((call) => ({
          ...call,
          researchLineNames: (call.researchLineIds || [])
            .map((id) => lineMap.get(id))
            .filter(Boolean) as string[],
        }));

        // Filtrar: separar vigentes (ABIERTA) de vencidas
        const activeCalls = enriched.filter((c) => c.status === 'ABIERTA');
        const expiredCalls = enriched.filter((c) => c.status !== 'ABIERTA');

        // Ordenar ambas listas por ID descendente
        activeCalls.sort((a, b) => b.id - a.id);
        expiredCalls.sort((a, b) => b.id - a.id);

        // Mostrar todas las vigentes y máximo las 2 últimas vencidas
        const limitedExpired = expiredCalls.slice(0, 2);
        const finalCalls = [...activeCalls, ...limitedExpired];

        setCalls(finalCalls);
      })
      .catch((err) => console.error('Error al obtener convocatorias:', err))
      .finally(() => setLoading(false));
  }, []);

  /** Helper: genera el link de compartir para una convocatoria */
  const getShareUrl = (call: CallResponse) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/novedades?convocatoria=${call.id}`;
  };

  /** Helper: formatea fecha a formato legible */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  /** Renderiza el badge de estado */
  const renderStatusBadge = (status: string) => {
    const statusClass = status === 'ABIERTA' ? 'open' : status === 'CERRADA' ? 'closed' : 'finished';
    const statusLabel = status === 'ABIERTA' ? t('news.open') : status === 'CERRADA' ? t('news.closed') : t('news.finished');
    return (
      <span className={`convocatoria-status-badge ${statusClass}`}>
        ● {statusLabel}
      </span>
    );
  };

  const getTargetAudienceLabel = (targetAudience?: string) => {
    if (!targetAudience) return '—';
    if (targetAudience === 'DOCENTES') return 'Docentes';
    if (targetAudience === 'ESTUDIANTES') return 'Estudiantes';
    if (targetAudience === 'AMBOS') return 'Docentes y Estudiantes';
    return targetAudience;
  };

  return (
    <div className="welcome-page-container">
      {/* Navbar Superior */}
      <header className="welcome-navbar">
        <div className="welcome-brand">
          <img src={universityIcon} alt="SGI Logo" className="welcome-logo-img-mini" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
        </div>

        {/* Enlaces de Navegación */}
        <nav className="welcome-nav-links">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="nav-link">
            {t('nav.home')}
          </a>

          {/* Dropdown: Novedades */}
          <div className="nav-dropdown">
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="nav-link dropdown-toggle active"
            >
              <span>{t('nav.news')}</span>
              <ChevronDown size={14} className="dropdown-caret" />
            </a>
            <div className="dropdown-menu">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleScrollToSection('novedades-convocatorias'); }}
                className="dropdown-item"
              >
                {t('nav.convocatorias')}
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleScrollToSection('novedades-reconocimientos'); }}
                className="dropdown-item"
              >
                {t('nav.reconocimiento')}
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleScrollToSection('novedades-congresos'); }}
                className="dropdown-item"
              >
                {t('nav.congresos')}
              </a>
            </div>
          </div>

          {/* Dropdown: Sobre nosotros */}
          <div className="nav-dropdown">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); navigate('/sobre-sgi'); }}
              className="nav-link dropdown-toggle"
            >
              <span>{t('nav.aboutUs')}</span>
              <ChevronDown size={14} className="dropdown-caret" />
            </a>
            <div className="dropdown-menu">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/sobre-sgi', { state: { scrollToHash: 'quienes-somos' } }); }}
                className="dropdown-item"
              >
                {t('nav.quienesSomos')}
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/sobre-sgi', { state: { scrollToHash: 'lineas-investigacion' } }); }}
                className="dropdown-item"
              >
                {t('nav.lineasInvestigacion')}
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/sobre-sgi', { state: { scrollToHash: 'grupos-investigacion' } }); }}
                className="dropdown-item"
              >
                {t('nav.grupos')}
              </a>
            </div>
          </div>

          {/* Dropdown: Contacto */}
          <div className="nav-dropdown">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); navigate('/contacto'); }}
              className="nav-link dropdown-toggle"
            >
              <span>{t('nav.contacto')}</span>
              <ChevronDown size={14} className="dropdown-caret" />
            </a>
            <div className="dropdown-menu">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/contacto', { state: { scrollToHash: 'contacto-form-section' } }); }}
                className="dropdown-item"
              >
                {t('nav.correo')}
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate('/contacto', { state: { scrollToHash: 'whatsapp-contact-section' } }); }}
                className="dropdown-item"
              >
                {t('nav.whatsapp')}
              </a>
            </div>
          </div>

          {/* Botón: Envía tu investigación */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigate('/login'); }}
            className="nav-link btn-submit-research"
          >
            {t('nav.submitResearch')}
          </a>
        </nav>

        <div className="welcome-navbar-actions">
          <LanguageSwitcher variant="button" className="btn-nav btn-language-selector" />
          
          <button 
            type="button" 
            onClick={() => navigate('/login')} 
            className="btn-nav btn-login-navbar"
          >
            <User size={15} />
            <span>{t('nav.login')}</span>
          </button>
        </div>
      </header>

      {/* Cuerpo Principal */}
      <section className="welcome-about-fiis-section" style={{ marginTop: '70px', minHeight: 'calc(100vh - 120px)' }}>
        <div className="about-fiis-container novedades-layout">
          
          {/* Columna Izquierda: Contenido Scrolleable */}
          <div className="about-fiis-main-content novedades-main-content">
            <div className="about-fiis-breadcrumbs">
              {t('news.breadcrumb')}
            </div>

            {/* Sección 1: Convocatorias */}
            {activeSection === 'novedades-convocatorias' && (
              <section id="novedades-convocatorias" className="about-stacked-section">
                <h2 className="about-fiis-title" style={{ marginBottom: '1.5rem' }}>
                  {t('news.officialAnnouncements')}
                </h2>

                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <div className="loading-spinner" style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f3f3',
                      borderTop: '4px solid #1a365d',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                  </div>
                ) : calls.length === 0 ? (
                  <div className="about-info-card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', margin: 0 }}>
                      {t('news.noActiveAnnouncements')}
                    </p>
                  </div>
                ) : (
                  <div className="convocatorias-grid">
                    {calls.map((call) => {
                      const isOpen = call.status === 'ABIERTA';
                      const shareUrl = getShareUrl(call);
                      const shareText = encodeURIComponent(call.title);

                      return (
                        <div key={call.id} className="convocatoria-card">
                          <div className="convocatoria-card-header">
                            <div className="convocatoria-card-brand">
                              <div className="convocatoria-card-logo-wrap">
                                <Megaphone className="convocatoria-card-megaphone" size={24} color="#ffffff" fill="#ffffff" />
                              </div>
                              <div className="convocatoria-card-brand-copy">
                                <span className="convocatoria-card-code">CONV-{call.id}</span>
                                <h3 className="convocatoria-card-title">{call.title}</h3>
                              </div>
                            </div>
                            {renderStatusBadge(call.status)}
                          </div>

                          <p className="convocatoria-card-desc">{call.description}</p>

                          <div className="convocatoria-card-details">
                            <div className="convocatoria-card-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Target size={16} color="#334155" />
                              <span>
                                <strong>Dirigido a: </strong>
                                {getTargetAudienceLabel(call.targetAudience)}
                              </span>
                            </div>

                            <div className="convocatoria-card-row" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Calendar size={16} color="#334155" />
                              <span>
                                <strong>Vigencia: </strong>
                                {formatDate(call.startDate)} — {formatDate(call.endDate)}
                              </span>
                            </div>
                          </div>

                          {call.researchLineNames && call.researchLineNames.length > 0 && (
                            <div className="convocatoria-lines-block">
                              <div className="convocatoria-lines-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BookOpen size={16} color="#334155" />
                                <strong>Líneas de investigación asociadas:</strong>
                              </div>
                              <div className="research-lines-container" style={{ display: 'block', marginTop: '0.35rem' }}>
                                {call.researchLineNames?.map((name, idx) => (
                                  <span key={`${call.id}-${idx}`} className="research-line-tag">
                                    {name}{idx < (call.researchLineNames?.length ?? 0) - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            className="convocatoria-view-btn"
                            onClick={() => isOpen && navigate('/login')}
                            disabled={!isOpen}
                          >
                            {isOpen ? 'Ver convocatoria' : 'Convocatoria cerrada'}
                          </button>

                          <div className="convocatoria-share">
                            <span className="convocatoria-share-label">Compartir en:</span>
                            <div className="convocatoria-share-icons">
                              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" title="Facebook">
                                <img src={facebookLogo} alt="Facebook" />
                              </a>
                              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                                <img src={linkedinLogo} alt="LinkedIn" />
                              </a>
                              <a href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                                <img src={whatsappLogo} alt="WhatsApp" />
                              </a>
                              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" title="Instagram">
                                <img src={instagramLogo} alt="Instagram" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Sección 2: Reconocimientos */}
            {activeSection === 'novedades-reconocimientos' && (
              <section id="novedades-reconocimientos" className="about-stacked-section">
                <h2 className="about-fiis-title" style={{ marginBottom: '1.5rem' }}>
                  {t('news.recognitionTitle')}
                </h2>
                
                <div className="about-info-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <div style={{
                    height: '240px',
                    backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%), url(${reconocimientoBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: '2rem',
                    display: 'flex',
                    alignItems: 'flex-end'
                  }}>
                    <div className="about-card-badge" style={{ backgroundColor: '#1a365d', color: '#ffffff' }}>{t('news.recognitionBadge')}</div>
                  </div>
                  <div style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
                      {t('news.recognitionSubtitle')}
                    </h3>
                    <p style={{ fontSize: '0.98rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
                      {t('news.recognitionDescription')}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '0.88rem', color: '#64748b' }}>
                      <span><strong>{t('news.publishingDate')}</strong> 28 de Junio, 2026</span>
                      <span><strong>{t('news.category')}</strong> {t('news.patentInnovation')}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Sección 3: Congresos */}
            {activeSection === 'novedades-congresos' && (
              <section id="novedades-congresos" className="about-stacked-section" style={{ paddingBottom: '4rem' }}>
                <h2 className="about-fiis-title" style={{ marginBottom: '1.5rem' }}>
                  {t('news.upcomingCongresses')}
                </h2>
                
                <div className="about-info-card" style={{ padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <div style={{
                    height: '240px',
                    backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%), url(${congresosBg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: '2rem',
                    display: 'flex',
                    alignItems: 'flex-end'
                  }}>
                    <div className="about-card-badge" style={{ backgroundColor: '#1a365d', color: '#ffffff' }}>{t('news.congressBadge')}</div>
                  </div>
                  <div style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 1rem 0', color: '#0f172a' }}>
                      {t('news.congressTitle')}
                    </h3>
                    <p style={{ fontSize: '0.98rem', color: '#475569', lineHeight: 1.6, margin: '0 0 1.5rem 0' }}>
                      {t('news.congressDescription')}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '0.88rem', color: '#64748b' }}>
                      <span><strong>{t('news.eventDate')}</strong> 15 de Junio, 2026</span>
                      <span><strong>{t('news.modality')}</strong> {t('news.hybrid')}</span>
                    </div>

                    <button 
                      onClick={() => navigate('/login')} 
                      className="btn-submit-contact"
                      style={{ marginTop: '1.5rem', width: 'auto', padding: '0.75rem 1.5rem' }}
                    >
                      {t('news.registerForEvent')}
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Columna Derecha: Sidebar Sticky con Botones Azules */}
          <aside className="about-fiis-sidebar novedades-sidebar">
            <h4 className="sidebar-title">{t('news.sidebarTitle')}</h4>
            <ul className="sidebar-menu">
              <li>
                <a 
                  href="#novedades-convocatorias" 
                  onClick={(e) => { e.preventDefault(); handleScrollToSection('novedades-convocatorias'); }} 
                  className={`sidebar-link ${activeSection === 'novedades-convocatorias' ? 'active' : ''}`}
                >
                  {t('nav.convocatorias')}
                </a>
              </li>
              <li>
                <a 
                  href="#novedades-reconocimientos" 
                  onClick={(e) => { e.preventDefault(); handleScrollToSection('novedades-reconocimientos'); }} 
                  className={`sidebar-link ${activeSection === 'novedades-reconocimientos' ? 'active' : ''}`}
                >
                  {t('nav.reconocimiento')}
                </a>
              </li>
              <li>
                <a 
                  href="#novedades-congresos" 
                  onClick={(e) => { e.preventDefault(); handleScrollToSection('novedades-congresos'); }} 
                  className={`sidebar-link ${activeSection === 'novedades-congresos' ? 'active' : ''}`}
                >
                  {t('nav.congresos')}
                </a>
              </li>
            </ul>
          </aside>

        </div>
      </section>

      {/* Footer */}
      <footer className="welcome-footer-premium">
        {/* Botón para subir (tipo chevron en el medio de la línea ploma) */}
        <div className="footer-scroll-top-container">
          <div className="footer-scroll-top-line" />
          <button
            className="footer-scroll-top-btn"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            title={t('footer.backToTop')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>

        <div className="footer-premium-content">
          <div className="footer-columns-wrapper" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="footer-column">
              <h4>{t('footer.faculty')}</h4>
              <ul>
                <li><a href="https://www.sistemasunas.edu.pe/nuestra-facultad/decanatura" target="_blank" rel="noopener noreferrer">{t('footer.decanatoFiis')}</a></li>
                <li><a href="https://www.sistemasunas.edu.pe/departamentos-academicos" target="_blank" rel="noopener noreferrer">{t('footer.departamentosAcademicos')}</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>{t('footer.research')}</h4>
              <ul>
                <li><a href="https://investigacion.unas.edu.pe" target="_blank" rel="noopener noreferrer">{t('footer.direccionGeneral')}</a></li>
                <li><a href="https://investigacion.unas.edu.pe/documentos-normativos" target="_blank" rel="noopener noreferrer">{t('footer.documentosNormativos')}</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>{t('footer.support')}</h4>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{t('footer.faq')}</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>{t('footer.userManual')}</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom-copyright">
          <p>{t('footer.copyrightFull')}</p>
        </div>
      </footer>
    </div>
  );
};
