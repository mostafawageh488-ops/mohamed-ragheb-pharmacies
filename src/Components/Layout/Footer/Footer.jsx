import React from 'react';

const Footer = () => {
  return (
    <footer style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
      <p>© {new Date().getFullYear()} صيدليات دكتور محمد راغب قريطم. جميع الحقوق محفوظة.</p>
    </footer>
  );
};

export default Footer;
