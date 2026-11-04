import os
import re
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix

def train_and_export():
    dataset_path = os.path.join(os.path.dirname(__file__), 'train.csv')
    df = pd.read_csv(dataset_path)

    raw_summary = {
        'total_records': int(len(df)),
        'total_features': int(len(df.columns)),
        'approved_count': int((df['Loan_Status'] == 'Y').sum()),
        'rejected_count': int((df['Loan_Status'] == 'N').sum()),
        'approval_rate': round(float((df['Loan_Status'] == 'Y').mean() * 100), 2),
        'missing_values': {col: int(df[col].isna().sum()) for col in df.columns if df[col].isna().sum() > 0},
        'avg_applicant_income': round(float(df['ApplicantIncome'].mean()), 2),
        'median_applicant_income': round(float(df['ApplicantIncome'].median()), 2),
        'avg_loan_amount': round(float(df['LoanAmount'].dropna().mean()), 2),
        'property_area_distribution': df['Property_Area'].value_counts().to_dict(),
        'education_distribution': df['Education'].value_counts().to_dict(),
        'credit_history_distribution': df['Credit_History'].dropna().value_counts().to_dict()
    }

    # Data Preprocessing matching notebook
    processed_df = df.copy()

    for col in processed_df.columns:
        if processed_df[col].isna().sum() > 0:
            if processed_df[col].dtype == 'object':
                fill_val = processed_df[col].mode()[0]
                processed_df[col] = processed_df[col].fillna(fill_val)
            else:
                fill_val = processed_df[col].median()
                processed_df[col] = processed_df[col].fillna(fill_val)

    # Clean Dependents (e.g. '3+' -> 3)
    processed_df['Dependents'] = processed_df['Dependents'].apply(
        lambda val: int(re.sub(r'[^0-9]', '', str(val)))
    )

    # Drop Loan_ID
    if 'Loan_ID' in processed_df.columns:
        processed_df.drop(columns=['Loan_ID'], inplace=True)

    # Label Encoding for categorical columns
    encoders = {}
    categorical_cols = ['Gender', 'Married', 'Education', 'Self_Employed', 'Property_Area', 'Loan_Status']
    
    for col in categorical_cols:
        if col in processed_df.columns:
            le = LabelEncoder()
            processed_df[col] = le.fit_transform(processed_df[col].astype(str))
            encoders[col] = {
                'classes': le.classes_.tolist(),
                'mapping': {label: int(idx) for idx, label in enumerate(le.classes_)}
            }

    feature_cols = [c for c in processed_df.columns if c != 'Loan_Status']
    X = processed_df[feature_cols]
    y = processed_df['Loan_Status']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=2022
    )

    # 1. Logistic Regression
    lr = LogisticRegression(max_iter=3000, solver='liblinear', random_state=2022)
    lr.fit(X_train, y_train)
    lr_pred = lr.predict(X_test)
    lr_prob = lr.predict_proba(X_test)[:, 1]

    # 2. Random Forest Classifier
    rfc = RandomForestClassifier(n_estimators=100, random_state=2022)
    rfc.fit(X_train, y_train)
    rfc_pred = rfc.predict(X_test)
    rfc_prob = rfc.predict_proba(X_test)[:, 1]

    feature_importances = dict(zip(feature_cols, [round(float(v), 4) for v in rfc.feature_importances_]))
    # Sort feature importances descending
    feature_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))

    def get_metrics(y_true, y_pred):
        cm = confusion_matrix(y_true, y_pred).tolist()
        return {
            'accuracy': round(float(accuracy_score(y_true, y_pred) * 100), 2),
            'f1_score': round(float(f1_score(y_true, y_pred)), 4),
            'precision': round(float(precision_score(y_true, y_pred)), 4),
            'recall': round(float(recall_score(y_true, y_pred)), 4),
            'confusion_matrix': {
                'tn': cm[0][0],
                'fp': cm[0][1],
                'fn': cm[1][0],
                'tp': cm[1][1]
            }
        }

    metrics = {
        'logistic_regression': get_metrics(y_test, lr_pred),
        'random_forest': get_metrics(y_test, rfc_pred),
        'feature_importances': feature_importances,
        'feature_names': feature_cols,
        'test_set_size': len(y_test),
        'train_set_size': len(y_train)
    }

    # Save artifacts
    artifacts_dir = os.path.dirname(__file__)
    joblib.dump(lr, os.path.join(artifacts_dir, 'model_lr.joblib'))
    joblib.dump(rfc, os.path.join(artifacts_dir, 'model_rfc.joblib'))
    
    with open(os.path.join(artifacts_dir, 'encoders.json'), 'w') as f:
        json.dump(encoders, f, indent=2)

    with open(os.path.join(artifacts_dir, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=2)

    with open(os.path.join(artifacts_dir, 'summary_stats.json'), 'w') as f:
        json.dump(raw_summary, f, indent=2)

    print("Successfully trained models and exported artifacts!")
    print(f"Logistic Regression F1: {metrics['logistic_regression']['f1_score']} | Accuracy: {metrics['logistic_regression']['accuracy']}%")
    print(f"Random Forest F1: {metrics['random_forest']['f1_score']} | Accuracy: {metrics['random_forest']['accuracy']}%")

if __name__ == '__main__':
    train_and_export()
