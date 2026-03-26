import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Shield, 
  FilePlus, 
  Activity, 
  Trophy, 
  UserCircle, 
  CheckCircle2, 
  AlertCircle,
  MapPin,
  Camera,
  Mic,
  ArrowRight
} from 'lucide-react';
import { useI18n } from '../i18n';

const GuideSection = ({ title, icon: Icon, children, delay = 0 }: { title: string, icon: any, children: React.ReactNode, delay?: number }) => (
  <motion.section 
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="mb-16"
  >
    <div className="flex items-center gap-4 mb-6">
      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-neutral-900">{title}</h2>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
  </motion.section>
);

const GuideCard = ({ title, description, steps }: { title: string, description: string, steps?: string[] }) => (
  <div className="bg-white p-8 rounded-[32px] border border-neutral-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
    <h3 className="text-lg font-bold text-neutral-900 mb-3 group-hover:text-indigo-600 transition-colors">{title}</h3>
    <p className="text-neutral-500 text-sm leading-relaxed mb-6">{description}</p>
    {steps && (
      <ul className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-xs font-medium text-neutral-600">
            <div className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-black">
              {i + 1}
            </div>
            {step}
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default function UserGuide() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest mb-6">
          <BookOpen className="w-4 h-4" />
          {t('guide.manual')}
        </div>
        <h1 className="text-5xl lg:text-6xl font-black tracking-tighter text-neutral-900 mb-6">
          {t('guide.welcome')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Civic Pillar</span>
        </h1>
        <p className="text-xl text-neutral-500 max-w-2xl mx-auto leading-relaxed">
          {t('guide.desc')}
        </p>
      </motion.div>

      <GuideSection title={t('guide.getting_started')} icon={Shield}>
        <GuideCard 
          title={t('guide.trust_score')} 
          description={t('guide.trust_score_desc')}
          steps={[
            t('guide.trust_step1'),
            t('guide.trust_step2'),
            t('guide.trust_step3'),
            t('guide.trust_step4')
          ]}
        />
        <GuideCard 
          title={t('guide.civic_identity')} 
          description={t('guide.civic_identity_desc')}
          steps={[
            t('guide.identity_step1'),
            t('guide.identity_step2'),
            t('guide.identity_step3')
          ]}
        />
      </GuideSection>

      <GuideSection title={t('guide.reporting_issues')} icon={FilePlus} delay={0.1}>
        <GuideCard 
          title={t('guide.intel_protocol')} 
          description={t('guide.intel_protocol_desc')}
          steps={[
            t('guide.intel_step1'),
            t('guide.intel_step2'),
            t('guide.intel_step3'),
            t('guide.intel_step4')
          ]}
        />
        <GuideCard 
          title={t('guide.issue_categories')} 
          description={t('guide.issue_categories_desc')}
          steps={[
            t('guide.cat_step1'),
            t('guide.cat_step2'),
            t('guide.cat_step3'),
            t('guide.cat_step4'),
            t('guide.cat_step5')
          ]}
        />
      </GuideSection>

      <GuideSection title={t('guide.live_monitoring')} icon={Activity} delay={0.2}>
        <GuideCard 
          title={t('guide.real_time_feed')} 
          description={t('guide.real_time_feed_desc')}
          steps={[
            t('guide.feed_step1'),
            t('guide.feed_step2'),
            t('guide.feed_step3')
          ]}
        />
        <GuideCard 
          title={t('guide.interactive_maps')} 
          description={t('guide.interactive_maps_desc')}
          steps={[
            t('guide.map_step1'),
            t('guide.map_step2'),
            t('guide.map_step3')
          ]}
        />
      </GuideSection>

      <GuideSection title={t('guide.multilingual')} icon={BookOpen} delay={0.3}>
        <GuideCard 
          title={t('guide.multilingual')} 
          description={t('guide.multilingual_desc')}
          steps={[
            t('guide.lang_step1'),
            t('guide.lang_step2'),
            t('guide.lang_step3')
          ]}
        />
      </GuideSection>

      <div className="bg-neutral-900 rounded-[40px] p-12 text-white relative overflow-hidden mb-20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight mb-6">{t('guide.ready')}</h2>
          <p className="text-neutral-400 mb-8 max-w-lg leading-relaxed">
            {t('guide.ready_desc')}
          </p>
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => navigate('/report')}
              className="px-8 py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-50 transition-colors flex items-center gap-2"
            >
              {t('guide.file_first')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <footer className="text-center pb-20">
        <p className="text-neutral-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">{t('guide.framework_version')}</p>
        <div className="flex justify-center gap-6">
          <a href="#" className="text-neutral-400 hover:text-indigo-600 transition-colors"><Shield className="w-5 h-5" /></a>
          <a href="#" className="text-neutral-400 hover:text-indigo-600 transition-colors"><Activity className="w-5 h-5" /></a>
          <a href="#" className="text-neutral-400 hover:text-indigo-600 transition-colors"><Trophy className="w-5 h-5" /></a>
        </div>
      </footer>
    </div>
  );
}
