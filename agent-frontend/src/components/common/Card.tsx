import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'bordered' | 'flat';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  className = '',
  onClick,
  ...props
}) => {
  const isInteractive = variant === 'interactive' || !!onClick;

  return (
    <div
      className={`${styles.card} ${styles[variant]} ${isInteractive ? styles.interactive : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};
