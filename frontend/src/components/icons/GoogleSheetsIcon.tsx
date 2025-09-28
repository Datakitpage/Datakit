import React from 'react';

interface GoogleSheetsIconProps {
  className?: string;
}

const GoogleSheetsIcon: React.FC<GoogleSheetsIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M19.5 22H4.5C3.39543 22 2.5 21.1046 2.5 20V4C2.5 2.89543 3.39543 2 4.5 2H14.5L21.5 9V20C21.5 21.1046 20.6046 22 19.5 22Z"
        fill="#0F9D58"
stroke="currentColor"
        strokeWidth="0.75"
      />
      <path
        d="M14.5 2V6.5C14.5 7.88071 15.6193 9 17 9H21.5L14.5 2Z"
        fill="#87CEAC"
      />
      <rect x="6.5" y="12" width="11" height="7" fill="white" />
      <path
        d="M6.5 12H17.5V19H6.5V12ZM8.5 14V15.5H10V14H8.5ZM8.5 16.5V18H10V16.5H8.5ZM11 14V15.5H12.5V14H11ZM13.5 14V15.5H15.5V14H13.5ZM11 16.5V18H12.5V16.5H11ZM13.5 16.5V18H15.5V16.5H13.5Z"
        fill="#0F9D58"
      />
    </svg>
  );
};

export default GoogleSheetsIcon;